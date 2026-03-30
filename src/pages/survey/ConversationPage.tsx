import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { useSurvey } from "../../hooks/useSurvey";
import { useConversation } from "../../hooks/useConversation";
import { useCountdownTimer } from "../../hooks/useCountdownTimer";
import { apiFetch } from "../../lib/api";
import { getSourceTrackingPayload } from "../../lib/sourceTracking";
import squareVideo from "../../lib/Square.mp4";

type ConversationOverrides = Parameters<
  typeof import("@elevenlabs/client").Conversation.startSession
>[0]["overrides"];

interface SignedUrlResult {
  signedUrl: string;
  sessionId: string;
  durationMinutes?: number;
  overrides?: ConversationOverrides;
}

type UiState = "idle" | "error" | "active" | "paused" | "ended";

function primeMicrophoneAccess() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return Promise.resolve();
  }
  return navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    })
    .catch(() => undefined);
}

export function ConversationPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { state, payload } = useSurvey(slug ?? null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [started, setStarted] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [localError, setLocalError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const {
    mode,
    status,
    error,
    transcript,
    conversationId,
    isPaused,
    start,
    stop,
    pause,
    resume,
    sendContextualUpdate,
  } = useConversation();

  const timerRunning =
    started &&
    !hasEnded &&
    !isPaused &&
    !connecting &&
    !ending &&
    status === "connected";

  const { formattedTime, resetTimer } = useCountdownTimer({
    durationMinutes,
    isRunning: timerRunning,
    onMilestone: (remainingSeconds) => {
      if (status !== "connected") {
        return;
      }
      const minutesRemaining = Math.max(1, Math.ceil(remainingSeconds / 60));
      sendContextualUpdate(
        `There are about ${minutesRemaining} minute(s) left in this survey. Please begin wrapping up naturally and close soon.`,
      );
    },
  });

  const visibleError = localError ?? error;
  const uiState: UiState = useMemo(() => {
    if (hasEnded) {
      return "ended";
    }
    if (started && isPaused) {
      return "paused";
    }
    if (started && !connecting && mode !== "error" && mode !== "ended") {
      return "active";
    }
    if (visibleError || mode === "error") {
      return "error";
    }
    return "idle";
  }, [hasEnded, isPaused, started, connecting, mode, visibleError]);

  const startConversation = useCallback(async () => {
    if (!payload || connecting) {
      return;
    }
    setLocalError(null);
    setHasEnded(false);
    setEnding(false);
    setConnecting(true);
    try {
      await primeMicrophoneAccess();
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
      setDurationMinutes(signed.durationMinutes ?? payload.survey.duration_minutes ?? 10);
      resetTimer(signed.durationMinutes ?? payload.survey.duration_minutes ?? 10);

      await start({
        signedUrl: signed.signedUrl,
        overrides: signed.overrides,
      });
      setStarted(true);
    } catch (startError) {
      setStarted(false);
      setLocalError(startError instanceof Error ? startError.message : "Unable to start voice session.");
    } finally {
      setConnecting(false);
    }
  }, [payload, connecting, searchParams, location.pathname, resetTimer, start]);

  const finishConversation = useCallback(async () => {
    if (ending || hasEnded) {
      return;
    }

    setEnding(true);
    try {
      await stop();
      if (sessionId) {
        await apiFetch(`/api/sessions/${sessionId}/complete`, {
          method: "POST",
          body: JSON.stringify({
            transcript,
            elevenlabs_conversation_id: conversationId ?? undefined,
          }),
        });
      }
      setHasEnded(true);
      setStarted(false);
    } catch (finishError) {
      setLocalError(finishError instanceof Error ? finishError.message : "Unable to end conversation.");
    } finally {
      setEnding(false);
    }
  }, [ending, hasEnded, stop, sessionId, transcript, conversationId]);

  useEffect(() => {
    if (mode === "ended" && started && !hasEnded && !ending) {
      void finishConversation();
    }
  }, [mode, started, hasEnded, ending, finishConversation]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (uiState === "active") {
      void video.play().catch(() => undefined);
      return;
    }
    video.pause();
    if (uiState === "idle" || uiState === "error") {
      video.currentTime = 0;
    }
  }, [uiState]);

  if (state.status === "loading") {
    return <div className="mobile-frame">Preparing conversation...</div>;
  }

  if (state.status === "error" || !payload) {
    return <div className="mobile-frame">Unable to load survey conversation.</div>;
  }

  return (
    <ThemeProvider brand={payload.brand}>
      <div className="charlotte-screen">
        <div className="charlotte-content">
          <div className="charlotte-header">
            <p>Hello, I&apos;m {payload.brand.persona_name}</p>
            <p>
              Let&apos;s talk about <span>{payload.survey.title}</span>
            </p>
          </div>

          <div className="charlotte-video-wrap">
            <video
              ref={videoRef}
              className="charlotte-video"
              src={squareVideo}
              muted
              loop
              playsInline
              preload="auto"
            />
          </div>

          {uiState !== "ended" ? (
            <div className="charlotte-controls">
              {uiState === "idle" || uiState === "error" ? (
                <button
                  type="button"
                  className="charlotte-button"
                  onClick={() => void startConversation()}
                  disabled={connecting}
                >
                  {connecting ? "Starting..." : "Start"}
                </button>
              ) : null}

              {uiState === "active" ? (
                <button
                  type="button"
                  className="charlotte-button"
                  onClick={() => void pause()}
                  disabled={ending}
                >
                  Pause
                </button>
              ) : null}

              {uiState === "paused" ? (
                <>
                  <button
                    type="button"
                    className="charlotte-button"
                    onClick={() => void resume()}
                    disabled={ending}
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    className="charlotte-link"
                    onClick={() => void finishConversation()}
                    disabled={ending}
                  >
                    {ending ? "Ending..." : "End Conversation"}
                  </button>
                </>
              ) : null}

              {visibleError ? <p className="charlotte-error">{visibleError}</p> : null}
              <p className="charlotte-timer">{formattedTime}</p>
            </div>
          ) : (
            <p className="charlotte-thanks">Thank You</p>
          )}
        </div>

        <p className="charlotte-footer">
          Charlotte is a conversational AI research tool. By continuing, you agree to our Terms of Service.
        </p>
      </div>
    </ThemeProvider>
  );
}
