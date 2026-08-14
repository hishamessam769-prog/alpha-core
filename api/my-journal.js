import { createClient } from "@supabase/supabase-js";

function jsonBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { return {}; }
}

function cleanNote(value) {
  return String(value ?? "").trim().slice(0, 1000);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") return response.status(204).end();
  if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
    return response.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !publishableKey) return response.status(500).json({ error: "Supabase configuration is missing." });

  const authorization = request.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return response.status(401).json({ error: "Authentication required." });

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) return response.status(401).json({ error: "Invalid session." });
  const userId = userData.user.id;

  try {
    if (request.method === "GET") {
      const [settingsResult, snapshotsResult] = await Promise.all([
        client.from("user_portfolio_settings").select("user_id,baseline_capital,baseline_date,created_at,updated_at").eq("user_id", userId).maybeSingle(),
        client.from("user_portfolio_snapshots").select("id,user_id,snapshot_date,portfolio_value,session_note,created_at,updated_at").eq("user_id", userId).order("snapshot_date", { ascending: true }).limit(5000),
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (snapshotsResult.error) throw snapshotsResult.error;
      return response.status(200).json({ settings: settingsResult.data || null, snapshots: snapshotsResult.data || [] });
    }

    const body = jsonBody(request);

    if (request.method === "PUT") {
      const baselineCapital = positiveNumber(body.baselineCapital);
      const baselineDate = validDate(body.baselineDate) ? body.baselineDate : null;
      if (!baselineCapital) return response.status(400).json({ error: "A positive baseline capital is required." });
      const payload = {
        user_id: userId,
        baseline_capital: baselineCapital,
        baseline_date: baselineDate,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await client
        .from("user_portfolio_settings")
        .upsert(payload, { onConflict: "user_id" })
        .select("user_id,baseline_capital,baseline_date,created_at,updated_at")
        .single();
      if (error) throw error;
      return response.status(200).json({ settings: data });
    }

    if (request.method === "POST") {
      const portfolioValue = positiveNumber(body.portfolioValue);
      const snapshotDate = String(body.snapshotDate || "");
      if (!portfolioValue) return response.status(400).json({ error: "A positive portfolio value is required." });
      if (!validDate(snapshotDate)) return response.status(400).json({ error: "A valid snapshot date is required." });
      const payload = {
        user_id: userId,
        snapshot_date: snapshotDate,
        portfolio_value: portfolioValue,
        session_note: cleanNote(body.sessionNote),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await client
        .from("user_portfolio_snapshots")
        .upsert(payload, { onConflict: "user_id,snapshot_date" })
        .select("id,user_id,snapshot_date,portfolio_value,session_note,created_at,updated_at")
        .single();
      if (error) throw error;
      return response.status(200).json({ snapshot: data });
    }

    if (request.method === "PATCH") {
      const id = String(body.id || "");
      const portfolioValue = positiveNumber(body.portfolioValue);
      const snapshotDate = String(body.snapshotDate || "");
      if (!id) return response.status(400).json({ error: "Snapshot id is required." });
      if (!portfolioValue) return response.status(400).json({ error: "A positive portfolio value is required." });
      if (!validDate(snapshotDate)) return response.status(400).json({ error: "A valid snapshot date is required." });
      const { data, error } = await client
        .from("user_portfolio_snapshots")
        .update({ snapshot_date: snapshotDate, portfolio_value: portfolioValue, session_note: cleanNote(body.sessionNote), updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
        .select("id,user_id,snapshot_date,portfolio_value,session_note,created_at,updated_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return response.status(404).json({ error: "Snapshot not found." });
      return response.status(200).json({ snapshot: data });
    }

    if (request.method === "DELETE") {
      const id = String(request.query?.id || jsonBody(request).id || "");
      if (!id) return response.status(400).json({ error: "Snapshot id is required." });
      const { error, count } = await client
        .from("user_portfolio_snapshots")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      if (!count) return response.status(404).json({ error: "Snapshot not found." });
      return response.status(200).json({ deleted: true });
    }
  } catch (error) {
    const message = error?.message || String(error);
    return response.status(500).json({ error: message.slice(0, 500) });
  }

  return response.status(405).json({ error: "Method not allowed" });
}
