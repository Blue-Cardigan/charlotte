import type { PropsWithChildren } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useAdminAuth } from "../../hooks/useAdminAuth";

export function AdminLayout({ children }: PropsWithChildren) {
  const auth = useAdminAuth();

  if (auth.status === "loading") {
    return <div className="mobile-frame">Checking admin session...</div>;
  }

  if (auth.status === "unauthenticated") {
    return <Navigate replace to="/admin" />;
  }

  return (
    <div className="mobile-frame">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <strong>Charlotte Admin</strong>
          <button
            type="button"
            className="button-secondary"
            onClick={async () => {
              await apiFetch("/api/auth/logout", { method: "POST" });
              void supabase.auth.signOut();
            }}
          >
            Sign out
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <Link to="/admin/dashboard">Dashboard</Link>
          <Link to="/admin/brands">Brands</Link>
          <Link to="/admin/surveys">Surveys</Link>
        </div>
      </div>
      {children}
    </div>
  );
}
