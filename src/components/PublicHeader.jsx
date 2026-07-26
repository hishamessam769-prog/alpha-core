import { Link, NavLink } from "react-router-dom";
import { LogIn, UserPlus } from "lucide-react";
import Brand from "./Brand";
import { useAuth } from "../context/AuthContext";

export default function PublicHeader() {
  const { session, isAdmin } = useAuth();

  return (
    <header className="public-header">
      <Brand />
      <nav className="public-nav">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/methodology">Methodology</NavLink>
        {session && <NavLink to="/dashboard">Dashboard</NavLink>}
      </nav>
      <div className="header-actions">
        {session ? (
          <Link className="button gold" to={isAdmin ? "/admin" : "/dashboard"}>
            Open {isAdmin ? "Admin" : "Dashboard"}
          </Link>
        ) : (
          <>
            <Link className="button subtle" to="/login"><LogIn size={15}/> Login</Link>
            <Link className="button gold" to="/signup"><UserPlus size={15}/> Join Free</Link>
          </>
        )}
      </div>
    </header>
  );
}
