import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Brand from "../components/Brand";
import SetupNotice from "../components/SetupNotice";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  if (session) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setMessage("Signing in…");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .maybeSingle();

    navigate(profile?.is_admin ? "/admin" : "/dashboard");
  };

  return (
    <div className="auth-page">
      <SetupNotice />
      <div className="single-auth">
        <Brand />
        <div className="auth-card">
          <span className="eyebrow">SECURE ACCESS</span>
          <h2>Welcome Back</h2>
          <p>Log in to open your ALPHA CORE dashboard.</p>
          <form onSubmit={submit}>
            <label>
              Email
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}/>
            </label>
            <label>
              Password
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)}/>
            </label>
            <button className="button gold full" type="submit">Log In</button>
          </form>
          {message && <div className="form-message">{message}</div>}
          <p className="auth-switch">New to ALPHA CORE? <Link to="/signup">Create a free account</Link></p>
        </div>
      </div>
    </div>
  );
}
