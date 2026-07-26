import { isConfigured } from "../lib/supabase";

export default function SetupNotice() {
  if (isConfigured) return null;
  return (
    <div className="setup-notice">
      Supabase keys have not been added yet. Add the two VITE environment variables in Vercel before publishing.
    </div>
  );
}
