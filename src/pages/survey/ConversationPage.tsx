import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { useSurvey } from "../../hooks/useSurvey";
import { useConversation } from "../../hooks/useConversation";
import { apiFetch } from "../../lib/api";
import { MicrophoneOrb } from "../../components/MicrophoneOrb";
import { CharlotteWaveform } from "../../components/CharlotteWaveform";
import { TextFallbackInput } from "../../components/TextFallbackInput";
import { getSourceTrackingPayload, getTrackingQueryString } from "../../lib/sourceTracking";

type ConversationOverrides = Parameters<typeof import("@elevenlabs/client").Conversation.startSession>[0]["overrides"];

interface SignedUrlResult {
  signedUrl: string;
  sessionId: string;
  overrides?: ConversationOverrides;
}

export function ConversationPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { state, payload } = useSurvey(slug ?? null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [started, setStarted] = useState(false);
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);

  const { mode, error, messages, liveAssistantText, transcript, conversationId, start, stop, addFallbackUserMessage } =
    useConversation();
  const trackingQuery = getTrackingQueryString(searchParams);

  const startConversation = useCallback(async () => {
    if (!payload) {
      return;
    }
    setAutoStartAttempted(true);
    setConnecting(true);
    try {
      const sourcePayload = getSourceTrackingPayload(searchParams, location.pathname);
      const signedUrlParams = new URLSearchParams({
        survey_id: payload.survey.id,
      });
      Object.entries(sourcePayload).forEach(([key, value]) => {
        if (value) {
          signedUrlParams.set(key, value);
        }
      });

      const signed = await apiFetch<SignedUrlResult>(
        `/api/signed-url?${signedUrlParams.toString()}`,
      );
      setSessionId(signed.sessionId);
      await start({
        signedUrl: signed.signedUrl,
        overrides: signed.overrides,
      });
      setStarted(true);
    } finally {
      setConnecting(false);
    }
  }, [payload, start, searchParams, location.pathname]);

  useEffect(() => {
    if (payload && !started && !connecting && !autoStartAttempted) {
      void startConversation();
    }
  }, [payload, started, connecting, autoStartAttempted, startConversation]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  const endConversation = useCallback(async () => {
    if (!sessionId) {
      return;
    }
    await stop();
    await apiFetch(`/api/sessions/${sessionId}/complete`, {
      method: "POST",
      body: JSON.stringify({
        transcript,
        elevenlabs_conversation_id: conversationId ?? undefined,
      }),
    });
    const thanksParams = new URLSearchParams(searchParams);
    thanksParams.set("session", sessionId);
    navigate(`/survey/${slug}/thanks?${thanksParams.toString()}`);
  }, [sessionId, stop, transcript, conversationId, navigate, slug, searchParams]);

  const messagePreview = useMemo(() => messages.slice(-5), [messages]);

  if (state.status === "loading") {
    return <div className="mobile-frame">Preparing conversation...</div>;
  }
  if (state.status === "error" || !payload) {
    return <div className="mobile-frame">Unable to load survey conversation.</div>;
  }

  return (
    <ThemeProvider brand={payload.brand}>
      <div className="mobile-frame">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Talk with {payload.brand.persona_name}</h2>
          <p className="muted">Mode: {mode}</p>
          {connecting ? (
            <p className="muted" style={{ marginTop: 6 }}>
              Starting voice...
            </p>
          ) : null}
          {!connecting && !started && !error ? (
            <p className="muted" style={{ marginTop: 6 }}>
              Voice should start automatically. If it does not, tap Retry audio.
            </p>
          ) : null}
          {trackingQuery ? (
            <p className="muted" style={{ fontSize: 12 }}>
              Source tracking active
            </p>
          ) : null}
          {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
          {error && !connecting ? (
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setAutoStartAttempted(false);
              }}
            >
              Retry audio
            </button>
          ) : null}
          <div style={{ marginTop: 18, minHeight: 220, display: "grid", placeItems: "center" }}>
            {mode === "speaking" ? <CharlotteWaveform /> : <MicrophoneOrb active={mode === "listening"} />}
          </div>
          {liveAssistantText ? (
            <p className="muted" style={{ marginTop: 8 }}>
              {payload.brand.persona_name}: {liveAssistantText}
            </p>
          ) : null}
          <button type="button" className="button-secondary" onClick={() => void endConversation()}>
            End and continue
          </button>
        </div>

        <div className="card" style={{ maxHeight: 220, overflow: "auto" }}>
          <strong>Recent transcript</strong>
          {messagePreview.length === 0 ? <p className="muted">Waiting for the conversation to begin...</p> : null}
          {messagePreview.map((message) => (
            <p key={`${message.timestamp}-${message.role}`} style={{ marginBottom: 8 }}>
              <strong>{message.role === "assistant" ? payload.brand.persona_name : "You"}:</strong> {message.text}
            </p>
          ))}
        </div>

        <TextFallbackInput
          disabled={connecting}
          onSubmit={async (text) => {
            addFallbackUserMessage(text);
          }}
        />
      </div>
    </ThemeProvider>
  );
}
