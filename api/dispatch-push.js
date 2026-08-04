import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const VAPID_PUBLIC_KEY = "BHzTwKq3huCAPgezSnUZsf6UAcI49H1BKqvmM-X8x9LM2PoUIK1wBf1-MmyXZz_osrwIc6V_dSWsMCgg6CM6my0";

function cleanText(value, fallback, max) {
  const text = String(value ?? "").trim() || fallback;
  return text.slice(0, max);
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });

  const body = request.body && typeof request.body === "object" ? request.body : {};
  const action = cleanText(body.action, "dispatch_pending", 80);
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@alpha-egx.com";
  const configured = Boolean(supabaseUrl && publishableKey && serviceRoleKey && vapidPrivateKey);

  if (!supabaseUrl || !serviceRoleKey) {
    return response.status(500).json({ error: "Missing Supabase server configuration." });
  }

  const authorization = request.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return response.status(401).json({ error: "Authentication required." });

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return response.status(401).json({ error: "Invalid session." });
  const requestingUserId = userData.user.id;

  const { data: profile } = await service
    .from("profiles")
    .select("is_admin,is_super_admin")
    .eq("id", requestingUserId)
    .maybeSingle();
  if (!profile?.is_admin && !profile?.is_super_admin) {
    return response.status(403).json({ error: "Admin access required." });
  }

  if (action === "status") {
    const [{ count: activeSubscriptions }, { count: pendingEvents }, latestResult] = await Promise.all([
      service.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("is_active", true),
      service.from("notification_events").select("id", { count: "exact", head: true }).in("status", ["pending", "failed"]),
      service.from("notification_events").select("id,status,created_at,processed_at,success_count,failure_count").order("created_at", { ascending: false }).limit(1),
    ]);
    return response.status(200).json({
      configured,
      activeSubscriptions: activeSubscriptions || 0,
      pendingEvents: pendingEvents || 0,
      latestEvent: latestResult.data?.[0] || null,
    });
  }

  if (!configured) {
    return response.status(500).json({ error: "Push delivery is not configured. Add SUPABASE_SERVICE_ROLE_KEY and VAPID_PRIVATE_KEY in Vercel." });
  }

  webpush.setVapidDetails(vapidSubject, VAPID_PUBLIC_KEY, vapidPrivateKey);

  async function getSubscriptions(audience = "all", targetUserId = null) {
    let query = service
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth_secret")
      .eq("is_active", true);
    if (audience === "self") {
      if (!targetUserId) throw new Error("A target user is required for a test notification.");
      query = query.eq("user_id", targetUserId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function deliverEvent(event, subscriptions) {
    let successCount = 0;
    let failureCount = 0;
    const errors = [];
    const payload = JSON.stringify({
      title: event.title,
      body: event.body,
      url: event.target_url || "/dashboard",
      tag: event.dedupe_key || event.id,
      eventType: event.event_type,
      data: event.payload || {},
    });

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
          },
          payload,
          { TTL: 60 * 60 * 12, urgency: "high" },
        );
        successCount += 1;
        await service
          .from("push_subscriptions")
          .update({ last_success_at: new Date().toISOString(), last_error: null, is_active: true })
          .eq("id", subscription.id);
      } catch (error) {
        failureCount += 1;
        const statusCode = Number(error?.statusCode || 0);
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${statusCode || "send"}: ${message}`);
        await service
          .from("push_subscriptions")
          .update({ is_active: ![404, 410].includes(statusCode), last_error: message.slice(0, 500) })
          .eq("id", subscription.id);
      }
    }

    const deliveredUsers = [...new Set(subscriptions.map((item) => item.user_id).filter(Boolean))];
    if (deliveredUsers.length) {
      await service.from("user_notification_inbox").update({ delivered_at: new Date().toISOString() }).eq("event_id", event.id).in("user_id", deliveredUsers);
    }

    const failedCompletely = subscriptions.length > 0 && successCount === 0;
    await service
      .from("notification_events")
      .update({
        status: failedCompletely ? "failed" : "sent",
        processed_at: new Date().toISOString(),
        recipient_count: subscriptions.length,
        success_count: successCount,
        failure_count: failureCount,
        last_error: errors.length ? errors.slice(0, 4).join(" | ").slice(0, 1000) : null,
      })
      .eq("id", event.id);

    return { successCount, failureCount };
  }

  try {
    if (action === "send_manual") {
      const audience = body.audience === "self" ? "self" : "all";
      const title = cleanText(body.title, "ALPHA CORE update", 180);
      const messageBody = cleanText(body.body, "A new update is available.", 500);
      const targetUrl = cleanText(body.targetUrl, "/dashboard", 500);
      const eventType = cleanText(body.eventType, "platform_update", 100);
      if (!targetUrl.startsWith("/")) {
        return response.status(400).json({ error: "The notification link must begin with /." });
      }

      const subscriptions = await getSubscriptions(audience, audience === "self" ? requestingUserId : null);
      if (!subscriptions.length) {
        return response.status(400).json({ error: audience === "self" ? "Enable notifications on this device before sending a test." : "No active subscribers are available yet." });
      }

      const { data: event, error: insertError } = await service
        .from("notification_events")
        .insert({
          event_type: eventType,
          title,
          body: messageBody,
          target_url: targetUrl,
          payload: { manual: true, audience, target_user_id: audience === "self" ? requestingUserId : null, actor_user_id: requestingUserId },
          status: "processing",
          attempts: 1,
        })
        .select("*")
        .single();
      if (insertError) throw insertError;
      const inboxUsers = [...new Set(subscriptions.map((item) => item.user_id).filter(Boolean))];
      if (inboxUsers.length) {
        await service.from("user_notification_inbox").upsert(inboxUsers.map((userId) => ({ user_id: userId, event_id: event.id })), { onConflict: "user_id,event_id" });
      }
      const result = await deliverEvent(event, subscriptions);
      return response.status(200).json({ processed: 1, audience, subscriptions: subscriptions.length, success: result.successCount, failed: result.failureCount, eventId: event.id });
    }

    if (action === "retry_event") {
      const eventId = cleanText(body.eventId, "", 100);
      if (!eventId) return response.status(400).json({ error: "Notification event is required." });
      const { data: event, error: eventError } = await service.from("notification_events").select("*").eq("id", eventId).single();
      if (eventError || !event) return response.status(404).json({ error: eventError?.message || "Notification event not found." });
      const audience = event.payload?.audience === "self" ? "self" : "all";
      const targetUserId = audience === "self" ? event.payload?.target_user_id || null : null;
      const subscriptions = await getSubscriptions(audience, targetUserId);
      await service.from("notification_events").update({ status: "processing", attempts: Number(event.attempts || 0) + 1, last_error: null }).eq("id", event.id);
      const result = await deliverEvent(event, subscriptions);
      return response.status(200).json({ processed: 1, subscriptions: subscriptions.length, success: result.successCount, failed: result.failureCount, eventId: event.id });
    }

    const { data: events, error: eventsError } = await service
      .from("notification_events")
      .select("*")
      .in("status", ["pending", "failed"])
      .order("created_at", { ascending: true })
      .limit(20);
    if (eventsError) throw eventsError;
    if (!events?.length) return response.status(200).json({ processed: 0, message: "No pending notifications." });

    let totalSuccess = 0;
    let totalFailure = 0;
    const broadcastEvents = events.filter((event) => event.payload?.audience !== "self");
    const selfEvents = events.filter((event) => event.payload?.audience === "self");

    if (broadcastEvents.length > 1) {
      const subscriptions = await getSubscriptions("all", null);
      const firstEvent = broadcastEvents[0];
      const extraCount = Math.max(0, broadcastEvents.length - 1);
      const digestEvent = {
        id: firstEvent.id,
        event_type: "notification_digest",
        title: firstEvent.title || `ALPHA has ${broadcastEvents.length} new updates`,
        body: extraCount
          ? `${firstEvent.body || "Open the latest update."} +${extraCount} more update${extraCount === 1 ? "" : "s"} in your inbox.`
          : (firstEvent.body || "Open the latest update."),
        target_url: firstEvent.target_url || "/notifications",
        dedupe_key: `digest-${new Date().toISOString().slice(0, 13)}`,
        payload: { digest: true, event_ids: broadcastEvents.map((item) => item.id), first_target_url: firstEvent.target_url || "/notifications" },
      };
      const result = await deliverEvent(digestEvent, subscriptions);
      totalSuccess += result.successCount;
      totalFailure += result.failureCount;
      await service.from("notification_events").update({ status: result.successCount ? "sent" : "failed", processed_at: new Date().toISOString(), recipient_count: subscriptions.length, success_count: result.successCount, failure_count: result.failureCount, payload: { digest: true } }).in("id", broadcastEvents.map((item) => item.id));
    } else if (broadcastEvents.length === 1) {
      const event = broadcastEvents[0];
      await service.from("notification_events").update({ status: "processing", attempts: Number(event.attempts || 0) + 1, last_error: null }).eq("id", event.id);
      const subscriptions = await getSubscriptions("all", null);
      const result = await deliverEvent(event, subscriptions);
      totalSuccess += result.successCount;
      totalFailure += result.failureCount;
    }

    for (const event of selfEvents) {
      const targetUserId = event.payload?.target_user_id || null;
      await service.from("notification_events").update({ status: "processing", attempts: Number(event.attempts || 0) + 1, last_error: null }).eq("id", event.id);
      try {
        const subscriptions = await getSubscriptions("self", targetUserId);
        const result = await deliverEvent(event, subscriptions);
        totalSuccess += result.successCount;
        totalFailure += result.failureCount;
      } catch (error) {
        totalFailure += 1;
        await service.from("notification_events").update({ status: "failed", processed_at: new Date().toISOString(), last_error: String(error?.message || error).slice(0, 1000) }).eq("id", event.id);
      }
    }

    return response.status(200).json({ processed: events.length, success: totalSuccess, failed: totalFailure, digested: broadcastEvents.length > 1 });
  } catch (error) {
    return response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
