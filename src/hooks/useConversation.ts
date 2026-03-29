import { useCallback, useMemo, useRef, useState } from "react";
import { Conversation } from "@elevenlabs/client";

type Mode = "idle" | "listening" | "speaking" | "ended" | "error";

interface MessageEntry {
  role: "assistant" | "user" | "system";
  text: string;
  timestamp: number;
}

type StartSessionOptions = Parameters<typeof Conversation.startSession>[0];

interface StartSessionInput {
  signedUrl: string;
  overrides?: StartSessionOptions["overrides"];
}

type ConversationSession = Awaited<ReturnType<typeof Conversation.startSession>>;

export function useConversation() {
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [liveAssistantText, setLiveAssistantText] = useState("");
  const sessionRef = useRef<ConversationSession | null>(null);
  const liveAssistantTextRef = useRef("");

  const appendMessage = useCallback((message: MessageEntry) => {
    setMessages((prev) => [...prev, message]);
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
    async ({ signedUrl, overrides }: StartSessionInput) => {
      setError(null);
      setMode("listening");
      setConversationId(null);
      liveAssistantTextRef.current = "";
      setLiveAssistantText("");
      const existingSession = sessionRef.current;
      if (existingSession) {
        await existingSession.endSession().catch(() => undefined);
      }
      const created = await Conversation.startSession({
        signedUrl,
        overrides,
        onConnect: ({ conversationId: id }: { conversationId: string }) => {
          setConversationId(id);
          appendMessage({
            role: "system",
            text: "Connected to Charlotte.",
            timestamp: Date.now(),
          });
        },
        onDisconnect: () => {
          flushLiveAssistantText();
          sessionRef.current = null;
          setSession(null);
          setMode("ended");
        },
        onError: (payload: unknown) => {
          const fallback = "Conversation error";
          if (typeof payload === "string") {
            setError(payload);
          } else {
            setError(fallback);
          }
          setMode("error");
        },
        onModeChange: ({ mode: nextMode }: { mode: "speaking" | "listening" }) => {
          setMode(nextMode);
        },
        onMessage: (payload: unknown) => {
          if (!payload || typeof payload !== "object") {
            return;
          }
          const event = payload as Record<string, unknown>;
          const type = typeof event.type === "string" ? event.type : "";

          if (type === "agent_chat_response_part") {
            const part = event.text_response_part as { text?: string; type?: "start" | "delta" | "stop" } | undefined;
            if (!part) {
              return;
            }
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
            return;
          }

          if (type === "agent_response") {
            const responseEvent = event.agent_response_event as { agent_response?: string } | undefined;
            const text = responseEvent?.agent_response?.trim();
            if (!text) {
              return;
            }
            const liveText = liveAssistantTextRef.current.trim();
            if (!liveText) {
              appendMessage({
                role: "assistant",
                text,
                timestamp: Date.now(),
              });
            } else if (liveText !== text) {
              appendMessage({
                role: "assistant",
                text,
                timestamp: Date.now(),
              });
              liveAssistantTextRef.current = "";
              setLiveAssistantText("");
            }
            return;
          }

          if (type === "user_transcript") {
            const userEvent = event.user_transcription_event as { user_transcript?: string } | undefined;
            const text = userEvent?.user_transcript?.trim();
            if (!text) {
              return;
            }
            appendMessage({
              role: "user",
              text,
              timestamp: Date.now(),
            });
            return;
          }

          // Backward compatibility with older payload shape.
          const legacy = event as { source?: "ai" | "user"; message?: string };
          if (legacy.message) {
            appendMessage({
              role: legacy.source === "user" ? "user" : "assistant",
              text: legacy.message,
              timestamp: Date.now(),
            });
          }
        },
      });
      sessionRef.current = created;
      setSession(created);
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
    setMode("ended");
  }, [flushLiveAssistantText]);

  const addFallbackUserMessage = useCallback((text: string) => {
    appendMessage({
      role: "user",
      text,
      timestamp: Date.now(),
    });
  }, [appendMessage]);

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
    error,
    conversationId,
    messages,
    liveAssistantText,
    transcript,
    start,
    stop,
    addFallbackUserMessage,
  };
}
