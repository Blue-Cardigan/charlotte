import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { SurveyResponse, SurveySession } from "../../../shared/contracts";
import { apiFetch } from "../../lib/api";
import { AdminLayout } from "./AdminLayout";

interface ResponseRow extends SurveyResponse {
  survey_questions: { question_text: string } | null;
}

export function ResponsesPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [sessions, setSessions] = useState<SurveySession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!surveyId) {
      return;
    }
    apiFetch<SurveySession[]>(`/api/sessions?survey_id=${encodeURIComponent(surveyId)}`, { auth: true })
      .then((rows) => {
        setSessions(rows);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load sessions.");
      });
  }, [surveyId]);

  useEffect(() => {
    if (!selectedSessionId) {
      return;
    }
    apiFetch<ResponseRow[]>(`/api/responses/session/${selectedSessionId}`, { auth: true })
      .then((rows) => {
        setResponses(rows);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load responses.");
      });
  }, [selectedSessionId]);

  return (
    <AdminLayout>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Survey sessions</h2>
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        {sessions.length === 0 ? <p className="muted">No responses yet.</p> : null}
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            className="button-secondary"
            style={{
              marginRight: 8,
              marginBottom: 8,
              background: selectedSessionId === session.id ? "var(--brand-accent)" : undefined,
              color: selectedSessionId === session.id ? "white" : undefined,
            }}
            onClick={() => setSelectedSessionId(session.id)}
          >
            {new Date(session.started_at).toLocaleString()}
            <br />
            <small style={{ opacity: 0.85 }}>
              {session.source ?? session.utm_source ?? "direct"}
            </small>
          </button>
        ))}
      </div>

      {selectedSessionId ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Extracted answers</h2>
          {responses.length === 0 ? <p className="muted">No extracted answers for this session yet.</p> : null}
          {responses.map((response) => (
            <div key={response.id} style={{ borderBottom: "1px solid #ece9f3", marginBottom: 12, paddingBottom: 12 }}>
              <p>
                <strong>{response.survey_questions?.question_text ?? "Question"}</strong>
              </p>
              <p>{response.extracted_answer ?? "No answer extracted."}</p>
              <small className="muted">
                Sentiment: {response.sentiment ?? "unknown"} | excerpt: {response.raw_excerpt ?? "n/a"}
              </small>
            </div>
          ))}
        </div>
      ) : null}
    </AdminLayout>
  );
}
