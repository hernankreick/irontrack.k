import React from 'react';

export default function CoachDashboardAttentionCard({
  title,
  items,
  isMobile,
  dashCard,
  dashBorder,
  dashCardSoft,
  dashMuted,
  colors,
  type,
}) {
  return (
    <div
      className="cd-card"
      style={{
        background: dashCard,
        border: `1px solid ${dashBorder}`,
        borderRadius: 16,
        padding: isMobile ? 14 : 18,
        boxSizing: "border-box",
        boxShadow: colors.darkMode ? "0 14px 40px rgba(0,0,0,0.18)" : "0 12px 32px rgba(15,23,42,0.06)",
      }}
    >
      <div style={{ ...type.sectionEyebrow, color: dashMuted, marginBottom: 14 }}>
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
          gap: isMobile ? 10 : 14,
        }}
      >
        {items.map(function (item) {
          var Icon = item.Icon;
          return (
            <div
              key={item.key}
              className="cd-attention-block"
              style={{
                display: "grid",
                gridTemplateColumns: "44px minmax(0, 1fr)",
                gap: 12,
                alignItems: "center",
                minWidth: 0,
                padding: 12,
                borderRadius: 13,
                border: "1px solid " + dashBorder,
                background: dashCardSoft,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "transparent",
                  border: "1px solid " + dashBorder,
                  color: item.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={20} color={item.color} strokeWidth={2.25} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...type.bodyLg, color: colors.t, fontWeight: 800 }}>
                  {item.count} {item.title}
                </div>
                <div style={{ ...type.body, color: colors.t2, marginTop: 3 }}>
                  {item.sub}
                </div>
                <button
                  type="button"
                  className="cd-btn"
                  style={{
                    marginTop: 10,
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 8,
                    border: "1px solid " + dashBorder,
                    background: "transparent",
                    color: colors.blue,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: typeof item.onClick === "function" ? "pointer" : "default",
                  }}
                  onClick={function () {
                    if (typeof item.onClick === "function") item.onClick();
                  }}
                >
                  {item.cta}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
