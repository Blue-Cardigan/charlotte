import { useCallback, useMemo, useState } from "react";
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

  const appendMessage = useCallback((message: MessageEntry) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const start = useCallback(
    async ({ signedUrl, overrides }: StartSessionInput) => {
      setError(null);
      setMode("listening");
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
          const candidate = payload as {
            source?: "ai" | "user";
            message?: string;
          };
          if (!candidate.message) {
            return;
          }
          appendMessage({
            role: candidate.source === "user" ? "user" : "assistant",
            text: candidate.message,
            timestamp: Date.now(),
          });
        },
      });
      setSession(created);
    },
    [appendMessage],
  );

  const stop = useCallback(async () => {
    if (!session) {
      return;
    }
    await session.endSession();
    setSession(null);
    setMode("ended");
  }, [session]);

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
    transcript,
    start,
    stop,
    addFallbackUserMessage,
  };
}
