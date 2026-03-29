import { useEffect, useMemo, useState } from "react";
import type { SurveyBundle } from "../../shared/contracts";
import { apiFetch } from "../lib/api";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: SurveyBundle };

export function useSurvey(slug: string | null) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!slug) {
      setState({ status: "error", error: "Missing survey slug." });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    apiFetch<SurveyBundle>(`/api/surveys/by-slug/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (!cancelled) {
          setState({ status: "ready", data });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            error: error instanceof Error ? error.message : "Unable to load survey.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const payload = useMemo(() => (state.status === "ready" ? state.data : null), [state]);

  return { state, payload };
}
