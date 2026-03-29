import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { useAdminAuth } from "../../hooks/useAdminAuth";

interface LoginResponse {
  ok: boolean;
  bypass?: boolean;
}

export function LoginPage() {
  const auth = useAdminAuth();
  const navigate = useNavigate();
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (auth.status === "authenticated") {
    return <Navigate replace to="/admin/dashboard" />;
  }

  const submit = async () => {
    setStatus("sending");
    setError(null);
    try {
      const response = await apiFetch<LoginResponse>("/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      if (response.bypass) {
        setStatus("idle");
        await auth.refresh();
        return;
      }
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unable to send magic link.");
    }
  };

  const localBypass = async () => {
    setStatus("sending");
    setError(null);
    try {
      await apiFetch<LoginResponse>("/api/auth/local-bypass", {
        method: "POST",
      });
      await auth.refresh();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unable to sign in locally.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="mobile-frame" style={{ justifyContent: "center" }}>
      <div className="card">
        <h1>Admin Login</h1>
        <p className="muted">
          Enter your admin email. On localhost, the configured admin email signs in directly; otherwise we send a
          secure magic link.
        </p>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@example.com"
        />
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button type="button" className="button-primary" onClick={() => void submit()} disabled={status === "sending"}>
            {status === "sending" ? "Sending..." : "Send link"}
          </button>
          <button type="button" className="button-secondary" onClick={() => navigate("/")}>
            Back
          </button>
        </div>
        {isLocalhost ? (
          <button
            type="button"
            className="button-secondary"
            style={{ marginTop: 10 }}
            onClick={() => void localBypass()}
          >
            Continue as local admin
          </button>
        ) : null}
        {status === "sent" ? <p style={{ color: "green" }}>Check your inbox for the magic link.</p> : null}
        {status === "error" ? <p style={{ color: "crimson" }}>{error}</p> : null}
      </div>
    </div>
  );
}
