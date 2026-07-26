import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const AuthContext = createContext(null);

async function loadProfile(user) {
  if (!user || !supabase) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return data;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      setProfileLoaded(true);
      return;
    }

    let active = true;
    const initialise = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      try {
        setProfile(await loadProfile(data.session?.user));
      } catch {
        setProfile(null);
      } finally {
        setProfileLoaded(true);
        setLoading(false);
      }
    };
    initialise();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!active) return;
      setLoading(true);
      setProfileLoaded(false);
      setSession(nextSession);
      try {
        setProfile(await loadProfile(nextSession?.user));
      } catch {
        setProfile(null);
      } finally {
        setProfileLoaded(true);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (!session?.user) return null;
    const next = await loadProfile(session.user);
    setProfile(next);
    return next;
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    window.location.href = "/";
  };

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    profile,
    loading,
    profileLoaded,
    refreshProfile,
    signOut,
  }), [session, profile, loading, profileLoaded]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
