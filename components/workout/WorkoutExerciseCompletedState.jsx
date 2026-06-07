export function WorkoutExerciseCompletedState({
  es,
  textMuted,
  hasSuggestedLoad,
  setsHoy,
  volumeText,
  activeExIdx,
  totalExercises,
  onNextExercise,
  Ic,
}) {
  return (
    <div
      style={{
        background: "#22c55e15",
        border: "1px solid #22c55e33",
        borderRadius: 12,
        padding: "16px",
        marginBottom: 12,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 4 }}>
        <Ic name="check-circle" size={22} color="#22C55E" />
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#22C55E" }}>
        {es ? "Ejercicio completado" : "Exercise complete"}
      </div>
      <div style={{ fontSize: 13, color: textMuted, marginTop: 4 }}>
        {hasSuggestedLoad ? volumeText : setsHoy.length + " sets"}
      </div>
      {activeExIdx < totalExercises - 1 && (
        <button
          className="hov"
          onClick={onNextExercise}
          style={{
            marginTop: 12,
            padding: "8px 24px",
            background: "#22C55E",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {es ? "Siguiente ejercicio →" : "Next exercise →"}
        </button>
      )}
    </div>
  );
}
