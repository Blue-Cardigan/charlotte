interface MicrophoneOrbProps {
  active: boolean;
  onClick?: () => void;
}

export function MicrophoneOrb({ active, onClick }: MicrophoneOrbProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Microphone"
      style={{
        width: 180,
        height: 180,
        borderRadius: "50%",
        border: "none",
        margin: "0 auto",
        display: "grid",
        placeItems: "center",
        color: "white",
        background: active
          ? "radial-gradient(circle at 30% 30%, var(--brand-accent), var(--brand-primary))"
          : "radial-gradient(circle at 30% 30%, var(--brand-primary), var(--brand-secondary))",
        boxShadow: active
          ? "0 0 0 18px color-mix(in oklab, var(--brand-accent) 24%, transparent)"
          : "0 0 0 12px color-mix(in oklab, var(--brand-primary) 16%, transparent)",
        animation: active ? "pulseMic 1.2s ease-out infinite" : "none",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ fontSize: 64, lineHeight: 1 }}>🎤</span>
      <style>{`
        @keyframes pulseMic {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
      `}</style>
    </button>
  );
}
