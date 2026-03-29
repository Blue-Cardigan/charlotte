export function CharlotteWaveform() {
  const bars = Array.from({ length: 21 }, (_, index) => index);
  return (
    <div
      aria-label="Charlotte speaking animation"
      style={{
        height: 180,
        width: 220,
        borderRadius: 999,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        background:
          "radial-gradient(circle at center, color-mix(in oklab, var(--brand-accent) 18%, transparent), transparent 65%)",
      }}
    >
      {bars.map((bar) => (
        <span
          key={bar}
          style={{
            width: 5,
            height: 26 + (bar % 8) * 6,
            borderRadius: 999,
            background:
              "linear-gradient(to top, var(--brand-primary), color-mix(in oklab, var(--brand-accent) 62%, white))",
            animation: `charlotteWave ${0.85 + (bar % 6) * 0.08}s ease-in-out ${bar * 0.03}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes charlotteWave {
          0% { transform: scaleY(0.38); opacity: 0.45; }
          100% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
