import React from "react";
import { ChevronDown } from "lucide-react";
import { coachType as T } from "../coachUiScale.js";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";

export default function ProgressMovementPatternRow({
  pattern,
  totalVol,
  isOpen,
  onToggle,
  C,
  lang,
  formatWeeklyVolKgAbbrev,
}) {
  var fillPct = totalVol > 0 ? Math.min(100, (100 * pattern.vol) / totalVol) : 0;

  return (
    <div key={pattern.key}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          margin: 0,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
          color: "inherit",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
              flex: "1 1 140px",
            }}
          >
            <ChevronDown
              size={18}
              color={C.t2}
              strokeWidth={2}
              style={{
                flexShrink: 0,
                transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 0.18s ease",
              }}
            />
            <span style={{ ...T.bodySemibold, fontWeight: 700, color: C.t, letterSpacing: 0.02 }}>
              {pattern.label}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              flexShrink: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span style={{ ...T.bodySemibold, fontWeight: 700, color: C.t }}>
              {formatWeeklyVolKgAbbrev(pattern.vol)}
            </span>
            <span
              style={{
                ...T.bodySemibold,
                fontWeight: 700,
                color: pattern.color,
                minWidth: 44,
                textAlign: "right",
              }}
            >
              {pattern.p}%
            </span>
          </div>
        </div>
        <div
          style={{
            height: 10,
            background: "#15151f",
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid #252536",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div
            style={{
              width: fillPct + "%",
              height: "100%",
              borderRadius: 6,
              background:
                "linear-gradient(90deg, " + pattern.color + "99 0%, " + pattern.color + " 55%, " + pattern.color + "dd 100%)",
              boxShadow: "0 0 12px " + pattern.color + "33",
            }}
          />
        </div>
      </button>
      {isOpen ? (
        <div
          style={{
            marginTop: 10,
            marginLeft: 26,
            paddingLeft: 12,
            borderLeft: "2px solid " + C.brd,
          }}
        >
          {(pattern.exercises || []).length === 0 ? (
            <div style={{ ...T.subtitle, color: C.t2 }}>
              {M(lang, "Sin series registradas en este bloque.", "No sets logged in this block.")}
            </div>
          ) : (
            (pattern.exercises || []).map(function (ex, exi) {
              var exList = pattern.exercises || [];
              return (
                <div
                  key={pattern.key + "-" + ex.ejercicio_id}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "6px 0",
                    borderBottom: exi < exList.length - 1 ? "1px solid #1e1e2e44" : "none",
                  }}
                >
                  <span
                    style={{
                      ...T.subtitle,
                      color: C.t,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {ex.name}
                  </span>
                  <span
                    style={{
                      ...T.labelMd,
                      color: C.t2,
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {ex.series}{" "}
                    {lang === "es"
                      ? ex.series === 1
                        ? "serie"
                        : "series"
                      : lang === "pt"
                        ? ex.series === 1
                          ? "série"
                          : "séries"
                        : ex.series === 1
                          ? "set"
                          : "sets"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
