import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../../lib/api";

export function ThankYouPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("session");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!sessionId || !email.trim()) {
      return;
    }
    setState("sending");
    setError(null);
    try {
      await apiFetch(`/api/sessions/${sessionId}/email`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Failed to send email.");
    }
  };

  return (
    <div className="mobile-frame">
      <div className="card" style={{ marginTop: "auto" }}>
        <h1>Thank you</h1>
        <p className="muted">Your voice responses have been captured.</p>

        <p style={{ marginTop: 22, marginBottom: 8 }}>Optional: send a copy of your responses by email</p>
        <div style={{ display: "grid", gap: 8 }}>
          <input
            className="input"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="button" className="button-secondary" onClick={() => void send()} disabled={state === "sending"}>
            {state === "sending" ? "Sending..." : "Send my responses"}
          </button>
        </div>
        {state === "done" ? <p style={{ color: "green" }}>Email sent.</p> : null}
        {state === "error" ? <p style={{ color: "crimson" }}>{error ?? "Could not send."}</p> : null}
      </div>
    </div>
  );
}
