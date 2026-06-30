import React from "react";
import { Star } from "lucide-react";
import { coachType as _T, coachSpace as _S, coachTypeMobile, coachSpaceMobile } from "../coachUiScale.js";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";

export default function ProgressRecentPrsCard({ prs, C, lang, emptyBox, isUnder768 }) {
  const T = isUnder768 ? coachTypeMobile : _T;
  const S = isUnder768 ? coachSpaceMobile : _S;
  var visiblePrs = prs.slice(0, 4);

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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: S.blockGap }}>
        <Star size={16} color={C.yel} strokeWidth={2} />
        <span style={{ ...T.cardTitle, color: C.t }}>
          {M(lang, "PRs recientes", "Recent PRs")}
        </span>
      </div>
      {prs.length === 0 ? (
        emptyBox(lang, M(lang, "Todavía no hay PRs registrados", "No PRs logged yet", "Ainda não há PRs registrados"), C)
      ) : (
        visiblePrs.map(function (row, idx) {
          return (
            <div
              key={row.initials + row.ex + row.date + idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 0",
                borderBottom: idx < visiblePrs.length - 1 ? "1px solid #1e1e2e44" : "none",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: row.color + "22",
                  color: row.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {row.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...T.bodySemibold, color: C.t }}>{row.n}</div>
                <div style={{ ...T.subtitle, color: C.t2, marginTop: 2 }}>{row.ex}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ ...T.numberStatSm, color: C.green }}>{row.val}</div>
                <div style={{ ...T.subtitle, color: C.green, marginTop: 2 }}>{row.delta}</div>
                <div style={{ ...T.subtitle, color: C.t2, marginTop: 2 }}>{row.date}</div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
