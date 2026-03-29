import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminIdentity } from "../../../shared/contracts";
import { apiFetch } from "../../lib/api";
import { AdminLayout } from "./AdminLayout";

export function DashboardPage() {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<AdminIdentity>("/api/auth/me", { auth: true })
      .then((data) => {
        if (!cancelled) {
          setAdmin(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load admin details.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminLayout>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Dashboard</h1>
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        {admin ? (
          <>
            <p>Email: {admin.email}</p>
            <p>Role: {admin.role}</p>
          </>
        ) : (
          <p className="muted">Loading admin profile...</p>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="button-secondary" to="/admin/brands">
            Manage brands
          </Link>
          <Link className="button-secondary" to="/admin/surveys">
            Manage surveys
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
