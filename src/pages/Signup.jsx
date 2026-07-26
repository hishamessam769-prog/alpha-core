import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import Brand from "../components/Brand";
import SetupNotice from "../components/SetupNotice";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
  const { session } = useAuth();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    newsletter: true,
  });
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState(false);

  if (session) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setMessage("Creating your free account…");

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          newsletter_opt_in: form.newsletter,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setCreated(true);
    setMessage("");
  };

  return (
    <div className="auth-page">
      <SetupNotice />
      <div className="auth-shell">
        <div className="auth-story">
          <Brand />
          <span className="eyebrow">FOUNDING MEMBER ACCESS</span>
          <h1>Follow the track record from month one.</h1>
          <p>
            Your free account unlocks the full portfolio, monthly history,
            decision log and downloadable reports.
          </p>
          <ul>
            <li><CheckCircle2/> Full performance dashboard</li>
            <li><CheckCircle2/> Monthly ALPHA CORE newsletter</li>
            <li><CheckCircle2/> Transparent stock-swap history</li>
          </ul>
        </div>

        <div className="auth-card">
          {created ? (
            <div className="success-state">
              <CheckCircle2 size={42}/>
              <h2>Account created</h2>
              <p>Check your email for the confirmation link, then return to log in.</p>
              <Link className="button gold full" to="/login">Go to Login</Link>
            </div>
          ) : (
            <>
              <h2>Create Free Account</h2>
              <p>No payment details. Founding access is currently free.</p>
              <form onSubmit={submit}>
                <label>
                  Full Name
                  <input required value={form.fullName} onChange={(e) => setForm({...form, fullName:e.target.value})} placeholder="Your name"/>
                </label>
                <label>
                  Email
                  <input required type="email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})} placeholder="name@email.com"/>
                </label>
                <label>
                  Password
                  <input required minLength="8" type="password" value={form.password} onChange={(e) => setForm({...form, password:e.target.value})} placeholder="Minimum 8 characters"/>
                </label>
                <label className="check-label">
                  <input type="checkbox" checked={form.newsletter} onChange={(e) => setForm({...form, newsletter:e.target.checked})}/>
                  <span>Send me the monthly ALPHA CORE newsletter and important strategy updates.</span>
                </label>
                <button className="button gold full" type="submit">Join ALPHA CORE Free</button>
              </form>
              {message && <div className="form-message">{message}</div>}
              <p className="auth-switch">Already registered? <Link to="/login">Log in</Link></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
