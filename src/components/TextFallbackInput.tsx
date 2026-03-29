import { useState } from "react";

interface TextFallbackInputProps {
  disabled?: boolean;
  onSubmit: (text: string) => Promise<void> | void;
}

export function TextFallbackInput({ disabled, onSubmit }: TextFallbackInputProps) {
  const [text, setText] = useState("");

  const submit = async () => {
    const clean = text.trim();
    if (!clean) {
      return;
    }
    await onSubmit(clean);
    setText("");
  };

  return (
    <div
      style={{
        position: "sticky",
        bottom: 12,
        marginTop: "auto",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 8,
        alignItems: "center",
      }}
    >
      <input
        className="input"
        disabled={disabled}
        placeholder="Or type your response..."
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <button type="button" className="button-primary" disabled={disabled} onClick={() => void submit()}>
        Send
      </button>
    </div>
  );
}
