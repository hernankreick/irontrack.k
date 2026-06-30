import React from "react";
import { BarChart2 } from "lucide-react";
import { coachType as _T, coachSpace as _S, coachTypeMobile, coachSpaceMobile } from "../coachUiScale.js";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";
import ProgressWeeklyVolumeBar from "./ProgressWeeklyVolumeBar.jsx";

export default function ProgressWeeklyVolumeCard({
  volBars,
  currentRoutineWeekIndex,
  maxV,
  volBarHoverIdx,
  setVolBarHoverIdx,
  C,
  lang,
  formatWeeklyVolKgAbbrev,
  formatWeeklyVolKgFull,
  isUnder768,
}) {
  const T = isUnder768 ? coachTypeMobile : _T;
  const S = isUnder768 ? coachSpaceMobile : _S;
  return (
    <div
      style={{
        background: C.card,
        border: "1px solid " + C.brd,
        borderRadius: 12,
        padding: S.cardPadding,
        minWidth: 0,
      }}
    >
      <div style={{ marginBottom: S.blockGap }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BarChart2 size={16} color={C.blue} strokeWidth={2} />
          <span style={{ ...T.cardTitle, color: C.t }}>
            {M(lang, "Volumen semanal (kg)", "Weekly volume (kg)")}
          </span>
        </div>
        <p style={{ ...T.subtitle, color: C.t2, margin: "8px 0 0 0" }}>
          {M(
            lang,
            "Rutina activa del alumno seleccionado · semana actual",
            "Selected athlete active plan · current week",
            "Rotina ativa do aluno selecionado · semana atual"
          )}
        </p>
      </div>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "center",
          width: "100%",
          minHeight: isUnder768 ? 130 : 188,
          boxSizing: "border-box",
          padding: "4px 10px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            maxWidth: isUnder768 ? 280 : 420,
            minHeight: isUnder768 ? 110 : 168,
          }}
        >
          {(volBars || []).map(function (bar, vidx) {
            return (
              <ProgressWeeklyVolumeBar
                key={"vol-bar-" + vidx}
                bar={bar}
                index={vidx}
                previousBar={vidx > 0 && volBars[vidx - 1] ? volBars[vidx - 1] : null}
                maxV={maxV}
                currentRoutineWeekIndex={currentRoutineWeekIndex}
                isHover={volBarHoverIdx === vidx}
                onHover={function () {
                  setVolBarHoverIdx(vidx);
                }}
                onLeave={function () {
                  setVolBarHoverIdx(null);
                }}
                C={C}
                lang={lang}
                formatWeeklyVolKgAbbrev={formatWeeklyVolKgAbbrev}
                formatWeeklyVolKgFull={formatWeeklyVolKgFull}
                isUnder768={isUnder768}
              />
            );
          })}
        </div>
      </div>
      {maxV <= 0 ? (
        <p style={{ ...T.subtitle, color: C.t2, margin: "12px 0 0 0", textAlign: "center" }}>
          {M(lang, "Sin volumen registrado en este bloque.", "No volume logged in this block.")}
        </p>
      ) : null}
    </div>
  );
}
