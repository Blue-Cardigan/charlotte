import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { useSurvey } from "../../hooks/useSurvey";
import { useConversation } from "../../hooks/useConversation";
import { useCountdownTimer } from "../../hooks/useCountdownTimer";
import { apiFetch } from "../../lib/api";
import { getSourceTrackingPayload } from "../../lib/sourceTracking";
import squareWebm from "../../lib/Square.webm";
import squareVideo from "../../lib/Square.mp4";
import squarePoster from "../../lib/Square-first-frame.jpg";

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

/**
 * On iOS, the AudioContext created by the SDK needs time to fully resume after
 * the user gesture that triggers session start. Without a delay, the first
 * audio chunks arrive before playback is ready, clipping the opening words.
 * Android already ships with a 3 000 ms default in the SDK; iOS has none.
 */
const CONNECTION_DELAY = {
  default: 0,
  android: 3_000,
  ios: 1_500,
};

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
  const wasPausedRef = useRef(false);

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
    sendUserActivity,
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
  const userFacingError = visibleError ? "something went wrong" : null;

  useEffect(() => {
    if (!visibleError) {
      return;
    }
    console.error("Conversation page error:", visibleError);
  }, [visibleError]);

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
        connectionDelay: CONNECTION_DELAY,
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

  useEffect(() => {
    if (!started || hasEnded || status !== "connected") {
      return;
    }

    if (isPaused && !wasPausedRef.current) {
      sendContextualUpdate(
        "The participant intentionally paused the conversation. Remain silent and wait until they continue.",
      );
      wasPausedRef.current = true;
    }

    if (!isPaused && wasPausedRef.current) {
      sendContextualUpdate(
        "The participant has resumed the conversation. Continue naturally from where you left off.",
      );
      wasPausedRef.current = false;
    }
  }, [isPaused, started, hasEnded, status, sendContextualUpdate]);

  useEffect(() => {
    if (!isPaused || !started || hasEnded || status !== "connected") {
      return;
    }

    const keepAlive = window.setInterval(() => {
      sendUserActivity();
    }, 1500);

    return () => {
      window.clearInterval(keepAlive);
    };
  }, [isPaused, started, hasEnded, status, sendUserActivity]);

  if (state.status === "loading") {
    return <div className="mobile-frame mobile-frame--center">Preparing conversation...</div>;
  }

  if (state.status === "error" || !payload) {
    return <div className="mobile-frame">Unable to load survey conversation.</div>;
  }

  const topicLabel =
    payload.brand.display_name?.trim() ||
    payload.survey.title.trim() ||
    "AI Generated Images";

  return (
    <ThemeProvider brand={payload.brand}>
      <div className="charlotte-screen">
        <div className="charlotte-content">
          <div className="charlotte-header">
            <p>Hello, I&apos;m {payload.brand.persona_name}</p>
            <p>
              Let&apos;s talk about <span>{topicLabel}</span>
            </p>
          </div>

          <div className="charlotte-video-wrap">
            <video
              ref={videoRef}
              className="charlotte-video"
              poster={squarePoster}
              muted
              loop
              playsInline
              preload="metadata"
            >
              <source src={squareWebm} type="video/webm" />
              <source src={squareVideo} type="video/mp4" />
            </video>
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
                </>
              ) : null}

              {uiState === "paused" ? (
                <button
                  type="button"
                  className="charlotte-link charlotte-link--subtle charlotte-end-action"
                  onClick={() => void finishConversation()}
                  disabled={ending}
                >
                  {ending ? "Ending..." : "End Conversation"}
                </button>
              ) : userFacingError ? (
                <p className="charlotte-error">{userFacingError}</p>
              ) : (
                <p className="charlotte-timer">{formattedTime}</p>
              )}
            </div>
          ) : (
            <p className="charlotte-thanks">Thank You</p>
          )}
        </div>

        <p className="charlotte-footer">
          Charlotte is a conversational AI research tool. <br />
          By continuing, you agree to our{" "}
          <a
            className="charlotte-link charlotte-link--subtle"
            href="https://odd-rise-5e7.notion.site/Charlotte-Terms-of-Service-333255150cd58078927df28720b365ea"
            target="_blank"
            rel="noreferrer"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            className="charlotte-link charlotte-link--subtle"
            href="https://odd-rise-5e7.notion.site/Charlotte-Privacy-Policy-333255150cd580e09921e56db34360a7"
            target="_blank"
            rel="noreferrer"
          >
            Privacy Policy
          </a>
        </p>
      </div>
    </ThemeProvider>
  );
}
