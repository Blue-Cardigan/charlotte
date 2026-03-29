import { FormEvent, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { WelcomePage } from "./pages/survey/WelcomePage";
import { ConversationPage } from "./pages/survey/ConversationPage";
import { ThankYouPage } from "./pages/survey/ThankYouPage";
import { LoginPage } from "./pages/admin/LoginPage";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { BrandsPage } from "./pages/admin/BrandsPage";
import { SurveyEditorPage } from "./pages/admin/SurveyEditorPage";
import { ResponsesPage } from "./pages/admin/ResponsesPage";
import { getTrackingQueryString } from "./lib/sourceTracking";

function SurveyParamRedirect() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const surveySlug = params.get("s");
  const [manualSlug, setManualSlug] = useState("");
  const trackingQuery = getTrackingQueryString(params);

  if (surveySlug) {
    return <Navigate replace to={`/survey/${encodeURIComponent(surveySlug)}/welcome${trackingQuery}`} />;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const slug = manualSlug.trim();
    if (!slug) {
      return;
    }
    navigate(`/survey/${encodeURIComponent(slug)}/welcome${trackingQuery}`);
  };

  return (
    <div className="mobile-frame" style={{ justifyContent: "center" }}>
      <div className="card">
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Something went wrong</h1>
        <p className="muted" style={{ lineHeight: 1.55 }}>
          We could not find a valid survey in this link. Please go back to where you found the invite and open the
          original link again.
        </p>
      </div>
    </div>
  );
}

function RootRedirect() {
  const location = useLocation();
  if (location.pathname === "/") {
    return <SurveyParamRedirect />;
  }
  return <Navigate replace to="/" />;
}

export function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/survey/:slug/welcome" element={<WelcomePage />} />
        <Route path="/survey/:slug/chat" element={<ConversationPage />} />
        <Route path="/survey/:slug/thanks" element={<ThankYouPage />} />
        <Route path="/admin" element={<LoginPage />} />
        <Route path="/admin/dashboard" element={<DashboardPage />} />
        <Route path="/admin/brands" element={<BrandsPage />} />
        <Route path="/admin/surveys" element={<SurveyEditorPage />} />
        <Route path="/admin/responses/:surveyId" element={<ResponsesPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </div>
  );
}
