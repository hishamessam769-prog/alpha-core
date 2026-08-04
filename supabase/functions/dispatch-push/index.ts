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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@alpha-egx.com";

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return json({ error: "Missing Supabase or VAPID secrets." }, 500);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const serviceCall = token === serviceRoleKey;
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!serviceCall) {
    if (!token) return json({ error: "Authentication required." }, 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid session." }, 401);

    const { data: profile } = await service
      .from("profiles")
      .select("is_admin, is_super_admin")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile?.is_admin && !profile?.is_super_admin) {
      return json({ error: "Admin access required." }, 403);
    }
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const { data: events, error: eventsError } = await service
    .from("notification_events")
    .select("*")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(20);
  if (eventsError) return json({ error: eventsError.message }, 500);
  if (!events?.length) return json({ processed: 0, message: "No pending notifications." });

  const { data: subscriptions, error: subscriptionsError } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_secret")
    .eq("is_active", true);
  if (subscriptionsError) return json({ error: subscriptionsError.message }, 500);

  let totalSuccess = 0;
  let totalFailure = 0;

  for (const event of events) {
    await service
      .from("notification_events")
      .update({ status: "processing", attempts: Number(event.attempts || 0) + 1, last_error: null })
      .eq("id", event.id);

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

    for (const subscription of subscriptions || []) {
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
          .update({
            is_active: ![404, 410].includes(statusCode),
            last_error: message.slice(0, 500),
          })
          .eq("id", subscription.id);
      }
    }

    totalSuccess += successCount;
    totalFailure += failureCount;
    const failedCompletely = (subscriptions?.length || 0) > 0 && successCount === 0;
    await service
      .from("notification_events")
      .update({
        status: failedCompletely ? "failed" : "sent",
        processed_at: new Date().toISOString(),
        recipient_count: subscriptions?.length || 0,
        success_count: successCount,
        failure_count: failureCount,
        last_error: errors.length ? errors.slice(0, 4).join(" | ").slice(0, 1000) : null,
      })
      .eq("id", event.id);
  }

  return json({
    processed: events.length,
    subscriptions: subscriptions?.length || 0,
    success: totalSuccess,
    failed: totalFailure,
  });
});
