import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, fallback: string, max: number) {
  const text = String(value ?? "").trim() || fallback;
  return text.slice(0, max);
}

type PushSubscriptionRow = {
  id: string;
  user_id?: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

type NotificationEvent = {
  id: string;
  event_type: string;
  title: string;
  body: string;
  target_url: string;
  payload?: Record<string, unknown> | null;
  dedupe_key?: string | null;
  attempts?: number;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let requestBody: Record<string, unknown> = {};
  try { requestBody = await request.json(); } catch { requestBody = {}; }
  const action = cleanText(requestBody.action, "dispatch_pending", 80);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@alpha-egx.com";
  const configured = Boolean(supabaseUrl && serviceRoleKey && vapidPublicKey && vapidPrivateKey);

  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase service configuration." }, 500);

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const serviceCall = token === serviceRoleKey;
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let requestingUserId: string | null = null;
  if (!serviceCall) {
    if (!token) return json({ error: "Authentication required." }, 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid session." }, 401);
    requestingUserId = userData.user.id;

    const { data: profile } = await service
      .from("profiles")
      .select("is_admin, is_super_admin")
      .eq("id", requestingUserId)
      .maybeSingle();
    if (!profile?.is_admin && !profile?.is_super_admin) return json({ error: "Admin access required." }, 403);
  }

  if (action === "status") {
    const [{ count: activeSubscriptions }, { count: pendingEvents }, { data: latestEvent }] = await Promise.all([
      service.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("is_active", true),
      service.from("notification_events").select("id", { count: "exact", head: true }).in("status", ["pending", "failed"]),
      service.from("notification_events").select("id,status,created_at,processed_at,success_count,failure_count").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return json({
      configured,
      activeSubscriptions: activeSubscriptions || 0,
      pendingEvents: pendingEvents || 0,
      latestEvent: latestEvent || null,
    });
  }

  if (!configured) return json({ error: "Missing VAPID secrets. Complete the one-time Push setup first." }, 500);
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  async function getSubscriptions(audience = "all", targetUserId: string | null = null) {
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
    return (data || []) as PushSubscriptionRow[];
  }

  async function deliverEvent(event: NotificationEvent, subscriptions: PushSubscriptionRow[]) {
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];
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
        const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${statusCode || "send"}: ${message}`);
        await service
          .from("push_subscriptions")
          .update({ is_active: ![404, 410].includes(statusCode), last_error: message.slice(0, 500) })
          .eq("id", subscription.id);
      }
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

    return { successCount, failureCount, errors };
  }

  if (action === "send_manual") {
    const audience = requestBody.audience === "self" ? "self" : "all";
    const targetUserId = audience === "self"
      ? (requestingUserId || cleanText(requestBody.targetUserId, "", 100) || null)
      : null;
    const title = cleanText(requestBody.title, "ALPHA CORE update", 180);
    const body = cleanText(requestBody.body, "A new update is available.", 500);
    const targetUrl = cleanText(requestBody.targetUrl, "/dashboard", 500);
    const eventType = cleanText(requestBody.eventType, "platform_update", 100);
    if (!targetUrl.startsWith("/")) return json({ error: "The notification link must be an internal path beginning with /." }, 400);

    const subscriptions = await getSubscriptions(audience, targetUserId);
    if (!subscriptions.length) {
      return json({ error: audience === "self" ? "Enable notifications on this device before sending a test." : "No active subscribers are available yet." }, 400);
    }

    const eventPayload = {
      manual: true,
      audience,
      target_user_id: targetUserId,
      actor_user_id: requestingUserId,
    };
    const { data: inserted, error: insertError } = await service
      .from("notification_events")
      .insert({
        event_type: eventType,
        title,
        body,
        target_url: targetUrl,
        payload: eventPayload,
        status: "processing",
        attempts: 1,
      })
      .select("*")
      .single();
    if (insertError) return json({ error: insertError.message }, 500);

    const result = await deliverEvent(inserted as NotificationEvent, subscriptions);
    return json({
      processed: 1,
      audience,
      subscriptions: subscriptions.length,
      success: result.successCount,
      failed: result.failureCount,
      eventId: inserted.id,
    });
  }

  if (action === "retry_event") {
    const eventId = cleanText(requestBody.eventId, "", 100);
    if (!eventId) return json({ error: "Notification event is required." }, 400);
    const { data: event, error: eventError } = await service
      .from("notification_events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (eventError || !event) return json({ error: eventError?.message || "Notification event not found." }, 404);

    const payload = (event.payload || {}) as Record<string, unknown>;
    const audience = payload.audience === "self" ? "self" : "all";
    const targetUserId = audience === "self" ? String(payload.target_user_id || "") || null : null;
    const subscriptions = await getSubscriptions(audience, targetUserId);
    await service
      .from("notification_events")
      .update({ status: "processing", attempts: Number(event.attempts || 0) + 1, last_error: null })
      .eq("id", event.id);
    const result = await deliverEvent(event as NotificationEvent, subscriptions);
    return json({ processed: 1, subscriptions: subscriptions.length, success: result.successCount, failed: result.failureCount, eventId: event.id });
  }

  const { data: events, error: eventsError } = await service
    .from("notification_events")
    .select("*")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(20);
  if (eventsError) return json({ error: eventsError.message }, 500);
  if (!events?.length) return json({ processed: 0, message: "No pending notifications." });

  let totalSuccess = 0;
  let totalFailure = 0;
  for (const event of events as NotificationEvent[]) {
    const payload = (event.payload || {}) as Record<string, unknown>;
    const audience = payload.audience === "self" ? "self" : "all";
    const targetUserId = audience === "self" ? String(payload.target_user_id || "") || null : null;
    await service
      .from("notification_events")
      .update({ status: "processing", attempts: Number(event.attempts || 0) + 1, last_error: null })
      .eq("id", event.id);
    try {
      const subscriptions = await getSubscriptions(audience, targetUserId);
      const result = await deliverEvent(event, subscriptions);
      totalSuccess += result.successCount;
      totalFailure += result.failureCount;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      totalFailure += 1;
      await service
        .from("notification_events")
        .update({ status: "failed", processed_at: new Date().toISOString(), last_error: message.slice(0, 1000) })
        .eq("id", event.id);
    }
  }

  return json({ processed: events.length, success: totalSuccess, failed: totalFailure });
});
