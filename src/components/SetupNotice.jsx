import { isSupabaseConfigured } from "../lib/supabase";

export default function SetupNotice() {
  if (isSupabaseConfigured) return null;
  return <div className="setup-notice">Supabase environment variables are missing.</div>;
}
