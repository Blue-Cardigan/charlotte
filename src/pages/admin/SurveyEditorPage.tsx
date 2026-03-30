import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Brand, Survey, SurveyQuestion } from "../../../shared/contracts";
import { apiFetch } from "../../lib/api";
import { AdminLayout } from "./AdminLayout";

interface SurveyWithBrand extends Survey {
  brands: Pick<Brand, "id" | "name">;
}

export function SurveyEditorPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [surveys, setSurveys] = useState<SurveyWithBrand[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyWithBrand | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newSurvey, setNewSurvey] = useState({
    brand_id: "",
    title: "",
    slug: "",
    status: "draft" as "draft" | "active" | "closed",
    duration_minutes: 10,
  });
  const [newQuestion, setNewQuestion] = useState({
    question_text: "",
    question_type: "open_ended" as SurveyQuestion["question_type"],
    follow_up_hint: "",
  });

  const load = async () => {
    const [brandRows, surveyRows] = await Promise.all([
      apiFetch<Brand[]>("/api/brands", { auth: true }),
      apiFetch<SurveyWithBrand[]>("/api/surveys", { auth: true }),
    ]);
    setBrands(brandRows);
    setSurveys(surveyRows);
  };

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load surveys.");
    });
  }, []);

  const loadQuestions = async (surveyId: string) => {
    const rows = await apiFetch<SurveyQuestion[]>(`/api/questions/survey/${surveyId}`, { auth: true });
    setQuestions(rows);
  };

  const orderedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.order_index - b.order_index),
    [questions],
  );

  return (
    <AdminLayout>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Create survey</h2>
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        <label>
          <small className="muted">Brand</small>
          <select
            className="input"
            value={newSurvey.brand_id}
            onChange={(event) => setNewSurvey((prev) => ({ ...prev, brand_id: event.target.value }))}
          >
            <option value="">Select brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <small className="muted">Title</small>
          <input
            className="input"
            value={newSurvey.title}
            onChange={(event) => setNewSurvey((prev) => ({ ...prev, title: event.target.value }))}
          />
        </label>
        <label>
          <small className="muted">Slug</small>
          <input
            className="input"
            value={newSurvey.slug}
            onChange={(event) => setNewSurvey((prev) => ({ ...prev, slug: event.target.value }))}
          />
        </label>
        <label>
          <small className="muted">Duration (minutes)</small>
          <input
            className="input"
            type="number"
            min={1}
            max={120}
            value={newSurvey.duration_minutes}
            onChange={(event) =>
              setNewSurvey((prev) => ({
                ...prev,
                duration_minutes: Number(event.target.value) || 10,
              }))
            }
          />
        </label>
        <button
          type="button"
          className="button-primary"
          onClick={() =>
            void apiFetch("/api/surveys", {
              method: "POST",
              auth: true,
              body: JSON.stringify(newSurvey),
            })
              .then(load)
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Could not create survey."),
              )
          }
        >
          Add survey
        </button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Surveys</h2>
        {surveys.map((survey) => (
          <div key={survey.id} style={{ borderBottom: "1px solid #e6e3f0", paddingBottom: 12, marginBottom: 12 }}>
            <strong>{survey.title}</strong>
            <p className="muted" style={{ margin: "6px 0" }}>
              {survey.brands?.name ?? "Brand"} / {survey.slug} / {survey.status}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setSelectedSurvey(survey);
                  void loadQuestions(survey.id);
                }}
              >
                Edit questions
              </button>
              <Link className="button-secondary" to={`/admin/responses/${survey.id}`}>
                Responses
              </Link>
            </div>
          </div>
        ))}
      </div>

      {selectedSurvey ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Questions - {selectedSurvey.title}</h3>
          {orderedQuestions.map((question, index) => (
            <div key={question.id} style={{ borderBottom: "1px solid #ece9f2", paddingBottom: 8, marginBottom: 8 }}>
              <p style={{ marginBottom: 4 }}>
                {index + 1}. {question.question_text}
              </p>
              <small className="muted">{question.question_type}</small>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    if (index === 0) {
                      return;
                    }
                    const prev = orderedQuestions[index - 1];
                    void apiFetch("/api/questions/reorder", {
                      method: "POST",
                      auth: true,
                      body: JSON.stringify({
                        items: [
                          { id: question.id, order_index: prev.order_index },
                          { id: prev.id, order_index: question.order_index },
                        ],
                      }),
                    }).then(() => loadQuestions(selectedSurvey.id));
                  }}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    if (index === orderedQuestions.length - 1) {
                      return;
                    }
                    const next = orderedQuestions[index + 1];
                    void apiFetch("/api/questions/reorder", {
                      method: "POST",
                      auth: true,
                      body: JSON.stringify({
                        items: [
                          { id: question.id, order_index: next.order_index },
                          { id: next.id, order_index: question.order_index },
                        ],
                      }),
                    }).then(() => loadQuestions(selectedSurvey.id));
                  }}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() =>
                    void apiFetch(`/api/questions/${question.id}`, {
                      method: "DELETE",
                      auth: true,
                    }).then(() => loadQuestions(selectedSurvey.id))
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          <h4>Add question</h4>
          <label>
            <small className="muted">Question text</small>
            <input
              className="input"
              value={newQuestion.question_text}
              onChange={(event) => setNewQuestion((prev) => ({ ...prev, question_text: event.target.value }))}
            />
          </label>
          <label>
            <small className="muted">Type</small>
            <select
              className="input"
              value={newQuestion.question_type}
              onChange={(event) =>
                setNewQuestion((prev) => ({
                  ...prev,
                  question_type: event.target.value as SurveyQuestion["question_type"],
                }))
              }
            >
              <option value="open_ended">open_ended</option>
              <option value="rating">rating</option>
              <option value="multiple_choice">multiple_choice</option>
              <option value="yes_no">yes_no</option>
            </select>
          </label>
          <label>
            <small className="muted">Follow-up hint</small>
            <input
              className="input"
              value={newQuestion.follow_up_hint}
              onChange={(event) => setNewQuestion((prev) => ({ ...prev, follow_up_hint: event.target.value }))}
            />
          </label>
          <button
            type="button"
            className="button-primary"
            onClick={() =>
              void apiFetch("/api/questions", {
                method: "POST",
                auth: true,
                body: JSON.stringify({
                  survey_id: selectedSurvey.id,
                  question_text: newQuestion.question_text,
                  question_type: newQuestion.question_type,
                  order_index: orderedQuestions.length,
                  follow_up_hint: newQuestion.follow_up_hint || null,
                  required: true,
                }),
              }).then(() => loadQuestions(selectedSurvey.id))
            }
          >
            Add question
          </button>
        </div>
      ) : null}
    </AdminLayout>
  );
}
