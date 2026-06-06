import React from "react";
import { Users } from "lucide-react";
import { coachType as T, coachSpace as S } from "../coachUiScale.js";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";

export default function ProgressRankingCard({
  ranking,
  rankingTop3,
  rankingRest,
  rankingCardUi,
  rankingSessionsLine,
  C,
  lang,
  emptyBox,
}) {
  return (
    <div
      style={{
        background: rankingCardUi.wrapBg,
        border: "1px solid " + C.brd,
        borderRadius: 14,
        padding: S.cardPaddingTight,
        minWidth: 0,
        boxShadow: rankingCardUi.wrapShadow,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: "linear-gradient(145deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0.08) 100%)",
              border: "1px solid rgba(59,130,246,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Users size={20} color={C.blue} strokeWidth={2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...T.cardTitle, fontWeight: 800, color: C.t }}>
              {M(lang, "Ranking de progreso", "Progress ranking")}
            </div>
            <div style={{ ...T.subtitle, color: C.t2, marginTop: 4 }}>
              {M(lang, "Bloque actual · 4 semanas", "Current block · 4 weeks")}
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.06,
            textTransform: "uppercase",
            color: rankingCardUi.adherBadgeColor,
            background: rankingCardUi.adherBadgeBg,
            border: rankingCardUi.adherBadgeBorder,
            padding: "5px 10px",
            borderRadius: 999,
            flexShrink: 0,
            alignSelf: "flex-start",
          }}
        >
          {M(lang, "Adherencia", "Adherence")}
        </span>
      </div>
      {ranking.length === 0 ? (
        emptyBox(lang, M(lang, "Sin métricas de adherencia", "No adherence metrics", "Sem métricas de aderência"), C)
      ) : (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rankingTop3.map(function (row, idx) {
              var medals = ["🥇", "🥈", "🥉"];
              var topTint = [
                "linear-gradient(135deg, rgba(234,179,8,0.14) 0%, rgba(234,179,8,0.03) 55%, transparent 100%)",
                "linear-gradient(135deg, rgba(148,163,184,0.18) 0%, rgba(148,163,184,0.04) 55%, transparent 100%)",
                "linear-gradient(135deg, rgba(180,83,9,0.16) 0%, rgba(180,83,9,0.04) 55%, transparent 100%)",
              ];
              var topBorder = [
                "1px solid rgba(234,179,8,0.35)",
                "1px solid rgba(148,163,184,0.35)",
                "1px solid rgba(180,83,9,0.35)",
              ];
              return (
                <div
                  key={row.id + "-top"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 14px",
                    borderRadius: 12,
                    background: topTint[idx] || topTint[2],
                    border: topBorder[idx] || topBorder[2],
                    boxShadow: rankingCardUi.topRowShadow,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      textAlign: "center",
                      fontSize: 22,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  >
                    {medals[idx] || String(idx + 1)}
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: row.color + "28",
                      color: row.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 800,
                      flexShrink: 0,
                      border: "2px solid " + row.color + "44",
                      boxShadow: "0 4px 14px " + row.color + "22",
                    }}
                  >
                    {row.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: C.t,
                        lineHeight: 1.25,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.n}
                    </div>
                    <div style={{ fontSize: 12, color: C.t2, marginTop: 4, lineHeight: 1.35 }}>
                      {rankingSessionsLine(row.completed, row.planned, lang)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        color: row.color,
                        lineHeight: 1.1,
                        fontVariantNumeric: "tabular-nums",
                        letterSpacing: -0.02,
                      }}
                    >
                      {row.p}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {rankingRest.length > 0 ? (
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: rankingCardUi.restBorderTop,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.08,
                  textTransform: "uppercase",
                  color: C.t2,
                  marginBottom: 8,
                  paddingLeft: 2,
                }}
              >
                {M(lang, "Resto del ranking", "Rest of leaderboard")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {rankingRest.map(function (row, j) {
                  var pos = j + 4;
                  return (
                    <div
                      key={row.id + "-rest"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "7px 10px",
                        borderRadius: 8,
                        transition: "background 0.15s ease",
                        cursor: "default",
                      }}
                      onMouseEnter={function (e) {
                        e.currentTarget.style.background = rankingCardUi.restRowHover;
                      }}
                      onMouseLeave={function (e) {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          fontSize: 12,
                          fontWeight: 800,
                          color: C.t2,
                          textAlign: "center",
                          fontVariantNumeric: "tabular-nums",
                          flexShrink: 0,
                        }}
                      >
                        {pos}
                      </div>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: row.color + "20",
                          color: row.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {row.initials}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: C.t,
                        }}
                      >
                        {row.n}
                      </div>
                      <div
                        style={{
                          width: 56,
                          height: 5,
                          background: rankingCardUi.miniBarTrack,
                          borderRadius: 3,
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            width: row.p + "%",
                            height: "100%",
                            background:
                              "linear-gradient(90deg, " + row.color + "aa, " + row.color + ")",
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          width: 34,
                          textAlign: "right",
                          fontFamily: "ui-monospace, monospace",
                          color: row.color,
                          fontVariantNumeric: "tabular-nums",
                          flexShrink: 0,
                        }}
                      >
                        {row.p}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
