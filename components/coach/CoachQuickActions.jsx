import React from "react";
import { ArrowRight } from "lucide-react";

export default function CoachQuickActions({
  title,
  actions = [],
  onRunQuick,
  ctaLabel,
  colors,
  type,
  dashMuted,
  dashCard,
  dashBorder,
  dashCardSoft,
  blockGap,
}) {
  var C = colors;
  var T = type;
  return (
    <div>
      <div
        style={{
          ...T.sectionEyebrow,
          color: dashMuted,
          marginBottom: blockGap,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        {actions.map(function (item) {
          var Qi = item.Icon;
          return (
            <div
              key={item.action}
              role="button"
              tabIndex={0}
              className="cd-quick-card"
              style={{
                ["--cd-q-sh"]: item.shadow,
                ["--cd-q-sh-h"]: item.shadowHover,
                position: "relative",
                overflow: "hidden",
                minHeight: 96,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "18px 18px",
                borderRadius: 14,
                cursor: "pointer",
                boxSizing: "border-box",
                background: dashCard,
                border: "1px solid " + dashBorder,
                boxShadow: "none",
              }}
              onClick={function () {
                if (typeof onRunQuick === "function") onRunQuick(item.action);
              }}
              onKeyDown={function (ev) {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  if (typeof onRunQuick === "function") onRunQuick(item.action);
                }
              }}
            >
              <div
                aria-hidden
                style={{
                  display: "none",
                  position: "absolute",
                  top: -40,
                  right: -30,
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 70%)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: dashCardSoft,
                  border: "1px solid " + dashBorder,
                  boxShadow: "none",
                }}
              >
                <Qi size={24} color={C.blue} strokeWidth={2.1} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 800,
                    lineHeight: 1.25,
                    color: C.t,
                  }}
                >
                  {item.title}
                </p>
                <p
                  style={{
                    margin: "5px 0 0 0",
                    fontSize: 13,
                    fontWeight: 500,
                    lineHeight: 1.35,
                    color: C.t2,
                    maxWidth: "100%",
                  }}
                >
                  {item.sub}
                </p>
              </div>
              <div
                className="cd-quick-cta"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  marginTop: 0,
                  paddingTop: 0,
                  borderTop: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: 0.02,
                  color: C.blue,
                  background: C.blueDim,
                  flexShrink: 0,
                }}
              >
                <span style={{ display: "none" }}>{ctaLabel}</span>
                <ArrowRight size={18} color="currentColor" strokeWidth={2.25} style={{ flexShrink: 0 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
