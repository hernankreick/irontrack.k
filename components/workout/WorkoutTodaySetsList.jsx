export function WorkoutTodaySetsList({
  setsHoy,
  bgCard,
  border,
  darkMode,
  textMuted,
  textMain,
  es,
  validationExercise,
  formatWorkoutSetLabel,
}) {
  return (
    <div style={{ background: bgCard, borderRadius: 12, border: "1px solid " + border, marginBottom: 12, overflow: "hidden" }}>
      <div
        style={{
          padding: "8px 14px",
          borderBottom: "1px solid " + (darkMode ? "#2D4057" : "#2D4057"),
          fontSize: 11,
          fontWeight: 800,
          color: textMuted,
          letterSpacing: 0.3,
        }}
      >
        {es ? "SETS DE HOY" : "TODAY'S SETS"}
      </div>
      <div>
        {setsHoy.slice().reverse().map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderBottom: i < setsHoy.length - 1 ? "1px solid " + border : "none",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#22C55E20",
                color: "#22C55E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: textMain }}>
              {formatWorkoutSetLabel(validationExercise, s)}
            </div>
            {s.rpe && <span style={{ fontSize: 13, color: textMuted, fontWeight: 500 }}>RPE {s.rpe}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
