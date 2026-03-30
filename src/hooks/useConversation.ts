import { useCallback, useMemo, useRef, useState } from "react";
import { Conversation } from "@elevenlabs/client";

type Mode = "idle" | "listening" | "speaking" | "ended" | "error";
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "disconnecting";

interface MessageEntry {
  role: "assistant" | "user" | "system";
  text: string;
  timestamp: number;
}

type StartSessionOptions = Parameters<typeof Conversation.startSession>[0];

interface StartSessionInput {
  signedUrl: string;
  overrides?: StartSessionOptions["overrides"];
  connectionDelay?: StartSessionOptions["connectionDelay"];
}

type ConversationSession = Awaited<ReturnType<typeof Conversation.startSession>>;

export function useConversation() {
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [liveAssistantText, setLiveAssistantText] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const sessionRef = useRef<ConversationSession | null>(null);
  const liveAssistantTextRef = useRef("");

  const appendMessage = useCallback((message: MessageEntry) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (
        last &&
        last.role === message.role &&
        last.text === message.text &&
        Math.abs(message.timestamp - last.timestamp) < 1500
      ) {
        return prev;
      }
      return [...prev, message];
    });
  }, []);

  const flushLiveAssistantText = useCallback(() => {
    const text = liveAssistantTextRef.current.trim();
    if (!text) {
      return;
    }
    appendMessage({
      role: "assistant",
      text,
      timestamp: Date.now(),
    });
    liveAssistantTextRef.current = "";
    setLiveAssistantText("");
  }, [appendMessage]);

  const start = useCallback(
    async ({ signedUrl, overrides, connectionDelay }: StartSessionInput) => {
      setError(null);
      setMode("listening");
      setStatus("connecting");
      setConversationId(null);
      setIsPaused(false);
      liveAssistantTextRef.current = "";
      setLiveAssistantText("");
      const existingSession = sessionRef.current;
      if (existingSession) {
        await existingSession.endSession().catch(() => undefined);
      }
      try {
        const created = await Conversation.startSession({
          signedUrl,
          overrides,
          connectionDelay,
          onConnect: ({ conversationId: id }: { conversationId: string }) => {
            setConversationId(id);
            appendMessage({
              role: "system",
              text: "Connected to Charlotte.",
              timestamp: Date.now(),
            });
          },
          onStatusChange: ({ status: nextStatus }) => {
            setStatus(nextStatus);
          },
          onDisconnect: (details: unknown) => {
            flushLiveAssistantText();
            sessionRef.current = null;
            setSession(null);
            setStatus("disconnected");
            setMode("ended");
            setIsPaused(false);
            const info = details as { reason?: string; message?: string; closeReason?: string } | undefined;
            if (info?.reason === "error") {
              setError(info.message ?? info.closeReason ?? "Voice connection closed unexpectedly.");
            }
          },
          onError: (message: string) => {
            setError(message || "Conversation error");
            setMode("error");
          },
          onModeChange: ({ mode: nextMode }: { mode: "speaking" | "listening" }) => {
            setMode(nextMode);
          },
          onAgentChatResponsePart: (part) => {
            const text = part.text ?? "";
            if (part.type === "start") {
              liveAssistantTextRef.current = text;
              setLiveAssistantText(text);
              return;
            }
            if (part.type === "delta") {
              liveAssistantTextRef.current += text;
              setLiveAssistantText(liveAssistantTextRef.current);
              return;
            }
            if (part.type === "stop") {
              flushLiveAssistantText();
            }
          },
          onMessage: (payload) => {
            const text = payload.message?.trim();
            if (!text) {
              return;
            }

            if (payload.source === "ai") {
              const liveText = liveAssistantTextRef.current.trim();
              if (liveText && (liveText === text || text.endsWith(liveText) || liveText.endsWith(text))) {
                flushLiveAssistantText();
                return;
              }
            }

            appendMessage({
              role: payload.source === "user" ? "user" : "assistant",
              text,
              timestamp: Date.now(),
            });
          },
        });
        sessionRef.current = created;
        setSession(created);
      } catch (err) {
        setStatus("disconnected");
        setMode("error");
        setIsPaused(false);
        setError(err instanceof Error ? err.message : "Unable to start voice session.");
        throw err;
      }
    },
    [appendMessage, flushLiveAssistantText],
  );

  const stop = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      return;
    }
    await activeSession.endSession().catch(() => undefined);
    flushLiveAssistantText();
    sessionRef.current = null;
    setSession(null);
    setStatus("disconnected");
    setMode("ended");
    setIsPaused(false);
  }, [flushLiveAssistantText]);

  const addFallbackUserMessage = useCallback((text: string) => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      setError("Start voice first, then send text.");
      return;
    }
    appendMessage({
      role: "user",
      text,
      timestamp: Date.now(),
    });
    try {
      activeSession.sendUserMessage(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send text message.");
    }
  }, [appendMessage]);

  const setMicMuted = useCallback((isMuted: boolean) => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      return;
    }
    activeSession.setMicMuted(isMuted);
  }, []);

  const setOutputMuted = useCallback((isMuted: boolean) => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      return;
    }
    activeSession.setVolume({ volume: isMuted ? 0 : 1 });
  }, []);

  const pause = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      return;
    }
    activeSession.setMicMuted(true);
    await activeSession.setVolume({ volume: 0 });
    setIsPaused(true);
  }, []);

  const resume = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      return;
    }
    activeSession.setMicMuted(false);
    await activeSession.setVolume({ volume: 1 });
    setIsPaused(false);
  }, []);

  const sendContextualUpdate = useCallback((text: string) => {
    const activeSession = sessionRef.current;
    if (!activeSession || !text.trim()) {
      return;
    }
    activeSession.sendContextualUpdate(text);
  }, []);

  const sendUserActivity = useCallback(() => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      return;
    }
    activeSession.sendUserActivity();
  }, []);

  const transcript = useMemo(
    () =>
      messages.map((item) => ({
        role: item.role,
        text: item.text,
        timestamp: item.timestamp,
      })),
    [messages],
  );

  return {
    mode,
    status,
    error,
    conversationId,
    messages,
    liveAssistantText,
    isPaused,
    transcript,
    start,
    stop,
    pause,
    resume,
    setMicMuted,
    setOutputMuted,
    sendContextualUpdate,
    sendUserActivity,
    addFallbackUserMessage,
  };
}
