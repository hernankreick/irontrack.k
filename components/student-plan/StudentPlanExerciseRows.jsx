import React from "react";
import { resolveExerciseTitle } from "../../lib/exerciseResolve.js";

export default function StudentPlanExerciseRows({
  day,
  routineId,
  dayIndex,
  allEx,
  currentWeekForRoutine,
  border,
  textMain,
  msg,
  es,
  fmtP,
  renderExerciseVideoButton,
}) {
  return (
    <>
      {(day.warmup || []).length > 0 && (
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 3, height: 12, borderRadius: 2, background: "#F59E0B" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", letterSpacing: 1 }}>{msg("ENTRADA EN CALOR", "WARM-UP")}</span>
          </div>
          {(day.warmup || []).map(function (ex, ei) {
            var inf = allEx.find(function (e) { return e.id === ex.id; });
            var nombre = resolveExerciseTitle(inf || null, ex, es);
            return (
              <div key={routineId + "-d" + dayIndex + "-wu-" + (ex.id || "ex") + "-" + ei} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0", borderBottom: ei < (day.warmup || []).length - 1 ? "1px solid " + border : "none" }}>
                <div style={{ width: 3, height: 20, borderRadius: 2, background: "#F59E0B44", flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: textMain }}>{nombre}</div>
                <span style={{ fontSize: 13, color: "#A3B4CC", fontWeight: 600 }}>{ex.sets || "-"}×{ex.reps || "-"}</span>
                {renderExerciseVideoButton(inf, ex, nombre)}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ width: 3, height: 12, borderRadius: 2, background: "#2563EB" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", letterSpacing: 1 }}>{msg("BLOQUE PRINCIPAL", "MAIN BLOCK")}</span>
        </div>
        {day.exercises.map(function (ex, ei) {
          var inf = allEx.find(function (e) { return e.id === ex.id; });
          var nombre = resolveExerciseTitle(inf || null, ex, es);
          var w = ((ex.weeks || [])[currentWeekForRoutine]) || {};
          var s = w.sets || ex.sets || "-";
          var rp = w.reps || ex.reps || "-";
          var kg2 = w.kg || ex.kg || "";
          return (
            <div key={routineId + "-d" + dayIndex + "-ex-" + (ex.id || "ex") + "-" + ei} style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", borderBottom: ei < day.exercises.length - 1 ? "1px solid " + border : "none" }}>
              <div style={{ width: 3, height: 24, borderRadius: 2, background: border, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: textMain }}>{nombre}</div>
                <div style={{ fontSize: 13, color: "#A3B4CC", fontWeight: 500, marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700 }}>{s}×{rp}</span>{kg2 && <span>{kg2}kg</span>}{ex.pause && <span>⏱ {fmtP(ex.pause)}</span>}
                </div>
              </div>
              {renderExerciseVideoButton(inf, ex, nombre)}
            </div>
          );
        })}
      </div>
    </>
  );
}
