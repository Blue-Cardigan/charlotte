import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { useSurvey } from "../../hooks/useSurvey";
import { useBrandTheme } from "../../hooks/useBrandTheme";
import { getTrackingQueryString } from "../../lib/sourceTracking";

export function WelcomePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, payload } = useSurvey(slug ?? null);
  const copy = useBrandTheme(payload?.brand ?? null);
  const trackingQuery = getTrackingQueryString(searchParams);

  if (state.status === "loading") {
    return <div className="mobile-frame">Loading survey...</div>;
  }
  if (state.status === "error" || !payload) {
    return (
      <div className="mobile-frame">
        <div className="card">
          <h1>Survey unavailable</h1>
          <p className="muted">{state.status === "error" ? state.error : "No survey found."}</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider brand={payload.brand}>
      <div className="mobile-frame">
        <div className="card" style={{ marginTop: "auto" }}>
          <p className="muted" style={{ marginTop: 0 }}>
            {payload.brand.name}
          </p>
          <h1 style={{ marginTop: 8, marginBottom: 10 }}>{copy.welcomeHeading}</h1>
          <p className="muted" style={{ lineHeight: 1.6 }}>
            {copy.welcomeBody}
          </p>
          <button
            type="button"
            className="button-primary"
            onClick={() => navigate(`/survey/${payload.survey.slug}/chat${trackingQuery}`)}
          >
            Okay, let's go
          </button>
        </div>
      </div>
    </ThemeProvider>
  );
}
