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

function sanitizeTranscriptText(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [outputMode, setOutputMode] = useState<"voice" | "text">("voice");
  const [showTextOptions, setShowTextOptions] = useState(false);

  const {
    mode,
    status,
    error,
    messages,
    liveAssistantText,
    transcript,
    conversationId,
    start,
    stop,
    setMicMuted,
    setOutputMuted,
    addFallbackUserMessage,
  } =
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

  useEffect(() => {
    setMicMuted(inputMode === "text");
  }, [inputMode, setMicMuted]);

  useEffect(() => {
    setOutputMuted(outputMode === "text");
  }, [outputMode, setOutputMuted]);

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
        <div className="card" style={{ position: "relative" }}>
          <button
            type="button"
            className="button-secondary"
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              padding: "6px 10px",
              fontSize: 12,
              opacity: 0.85,
            }}
            onClick={() => setShowTextOptions((value) => !value)}
          >
            Text options
          </button>
          {showTextOptions ? (
            <div
              className="card"
              style={{
                position: "absolute",
                top: 50,
                right: 14,
                width: 220,
                padding: 12,
                zIndex: 2,
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span className="muted" style={{ fontSize: 13 }}>
                  Input
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className={inputMode === "voice" ? "button-primary" : "button-secondary"}
                    style={{ padding: "5px 8px", fontSize: 12 }}
                    onClick={() => setInputMode("voice")}
                  >
                    Voice
                  </button>
                  <button
                    type="button"
                    className={inputMode === "text" ? "button-primary" : "button-secondary"}
                    style={{ padding: "5px 8px", fontSize: 12 }}
                    onClick={() => setInputMode("text")}
                  >
                    Text
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span className="muted" style={{ fontSize: 13 }}>
                  Output
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className={outputMode === "voice" ? "button-primary" : "button-secondary"}
                    style={{ padding: "5px 8px", fontSize: 12 }}
                    onClick={() => setOutputMode("voice")}
                  >
                    Voice
                  </button>
                  <button
                    type="button"
                    className={outputMode === "text" ? "button-primary" : "button-secondary"}
                    style={{ padding: "5px 8px", fontSize: 12 }}
                    onClick={() => setOutputMode("text")}
                  >
                    Text
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <h2 style={{ marginTop: 0 }}>Talk with {payload.brand.persona_name}</h2>
          <p className="muted">Mode: {mode}</p>
          <p className="muted">Connection: {status}</p>
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
          {inputMode === "text" || outputMode === "text" ? (
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Alternative mode active:
              {inputMode === "text" ? " text input" : " voice input"}
              {" / "}
              {outputMode === "text" ? "text output" : "voice output"}
            </p>
          ) : null}
          {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
          {!connecting && (!started || mode === "error" || mode === "ended") ? (
            <button
              type="button"
              className="button-secondary"
              onClick={() => void startConversation()}
            >
              {started ? "Retry audio" : "Start voice"}
            </button>
          ) : null}
          <div style={{ marginTop: 18, minHeight: 220, display: "grid", placeItems: "center" }}>
            {mode === "speaking" ? <CharlotteWaveform /> : <MicrophoneOrb active={mode === "listening"} />}
          </div>
          {liveAssistantText ? (
            <p className="muted" style={{ marginTop: 8 }}>
              {payload.brand.persona_name}: {sanitizeTranscriptText(liveAssistantText)}
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
              <strong>{message.role === "assistant" ? payload.brand.persona_name : "You"}:</strong>{" "}
              {sanitizeTranscriptText(message.text)}
            </p>
          ))}
        </div>

        <TextFallbackInput
          disabled={connecting || status !== "connected"}
          onSubmit={async (text) => {
            addFallbackUserMessage(text);
          }}
        />
      </div>
    </ThemeProvider>
  );
}
