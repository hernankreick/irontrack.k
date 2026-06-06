import React from "react";
import { CheckCircle } from "lucide-react";
import { coachType as T, coachSpace as S } from "../coachUiScale.js";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";

export default function ProgressAdherenceCard({ rows, C, lang, emptyBox }) {
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: S.blockGapLoose }}>
        <CheckCircle size={16} color={C.green} strokeWidth={2} />
        <span style={{ ...T.cardTitle, color: C.t }}>
          {M(lang, "Adherencia al plan", "Plan adherence")}
        </span>
      </div>
      {rows.length === 0 ? (
        emptyBox(lang, M(lang, "Ningún alumno tiene rutina asignada", "No athletes with an assigned plan", "Nenhum aluno tem rotina atribuída"), C)
      ) : (
        rows.map(function (row) {
          return (
            <div
              key={row.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  ...T.bodySemibold,
                  color: "#fff",
                  width: 128,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.n}
              </div>
              <div
                style={{
                  flex: 1,
                  height: 10,
                  background: C.brd,
                  borderRadius: 5,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: row.p + "%",
                    height: "100%",
                    background: row.color,
                    borderRadius: 5,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
              <div
                style={{
                  ...T.bodySemibold,
                  fontWeight: 700,
                  width: 40,
                  textAlign: "right",
                  fontFamily: "ui-monospace, monospace",
                  color: row.color,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {row.p}%
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
