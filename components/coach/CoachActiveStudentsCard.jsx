import React from "react";

export default function CoachActiveStudentsCard({
  title,
  seeAllLabel,
  onSeeAll,
  emptyText,
  isMobile,
  mobileRows = [],
  desktopRows = [],
  desktopHeaders = [],
  colors,
  type,
  dashCard,
  dashBorder,
  blockGap,
  navItemPad,
}) {
  var C = colors;
  var T = type;
  var rows = isMobile ? mobileRows : desktopRows;
  return (
    <div
      className="cd-card"
      style={{
        background: dashCard,
        border: `1px solid ${dashBorder}`,
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: blockGap,
        }}
      >
        <span style={{ ...T.cardTitleSemibold, color: C.t }}>{title}</span>
        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            color: C.blue,
            ...T.link,
            cursor: "pointer",
            padding: 0,
          }}
          onClick={function () {
            if (typeof onSeeAll === "function") onSeeAll();
          }}
        >
          {seeAllLabel}
        </button>
      </div>
      {rows.length === 0 ? (
        <div
          style={{
            padding: "22px 12px",
            textAlign: "center",
            ...T.body,
            color: C.t2,
            borderRadius: 8,
            background: C.cardDark,
            border: `1px dashed ${C.brd}`,
          }}
        >
          {emptyText}
        </div>
      ) : isMobile ? (
        <div style={{ maxHeight: 440, overflowY: "auto" }}>
          {mobileRows.map(function (row) {
            return (
              <div
                key={String(row.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  boxSizing: "border-box",
                  borderBottom: row.borderBottom,
                  cursor: row.rowCursor,
                }}
                onClick={row.onClick}
                role={row.role}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: row.avatarBg,
                    color: C.t,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                    fontFamily: "DM Sans, system-ui, sans-serif",
                  }}
                >
                  {row.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      ...T.body,
                      color: C.t,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.name}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: row.estadoColor,
                      marginTop: 2,
                      fontFamily: "DM Sans, system-ui, sans-serif",
                    }}
                  >
                    {row.ult}
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      width: "fit-content",
                      marginTop: 6,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: row.statusBg,
                      color: row.statusColor,
                      fontSize: 11,
                      fontWeight: 800,
                      lineHeight: 1.2,
                      fontFamily: "DM Sans, system-ui, sans-serif",
                    }}
                  >
                    {row.statusLabel}
                  </div>
                  <div
                    style={{
                      height: 3,
                      borderRadius: 2,
                      marginTop: 4,
                      background: C.brd,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: row.pct + "%",
                        height: "100%",
                        background: row.percentColor,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    minWidth: 44,
                    textAlign: "right",
                    fontFamily: "DM Mono, ui-monospace, monospace",
                    fontSize: 14,
                    fontWeight: 700,
                    color: row.percentColor,
                    flexShrink: 0,
                  }}
                >
                  {row.pct}%
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ maxHeight: 440, overflowY: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(180px,1.2fr) 150px 150px 150px 230px",
              gap: 10,
              padding: "10px 12px 8px",
              boxSizing: "border-box",
              borderBottom: "1px solid " + C.rowDivider,
            }}
          >
            {desktopHeaders.map(function (h) {
              return (
                <div
                  key={h}
                  style={{
                    ...T.tableHeader,
                    color: C.t2,
                    letterSpacing: 0.08,
                  }}
                >
                  {h}
                </div>
              );
            })}
          </div>
          {desktopRows.map(function (row) {
            return (
              <div
                key={String(row.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(180px,1.2fr) 150px 150px 150px 230px",
                  gap: 10,
                  alignItems: "center",
                  padding: navItemPad,
                  boxSizing: "border-box",
                  borderBottom: row.borderBottom,
                  cursor: row.rowCursor,
                }}
                onClick={row.onClick}
                role={row.role}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: row.avatarBg,
                      color: row.percentColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {row.initials}
                  </div>
                  <span
                    style={{
                      ...T.body,
                      color: C.t,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.name}
                  </span>
                </div>
                <div>
                  <div style={{ ...T.bodySemibold, color: row.percentColor, fontWeight: 700 }}>{row.pct}%</div>
                  <div
                    style={{
                      height: 7,
                      background: C.brd,
                      borderRadius: 3,
                      marginTop: 5,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: row.pct + "%",
                        height: "100%",
                        background: row.percentColor,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
                <div style={{ ...T.subtitle, color: row.sessionColor }}>{row.ult}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      maxWidth: 92,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: row.statusBg,
                      color: row.statusColor,
                      fontSize: 11,
                      fontWeight: 800,
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.statusLabel}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  {row.actions.map(function (action) {
                    return (
                      <button
                        key={action.key}
                        type="button"
                        className="cd-btn"
                        style={{
                          height: 30,
                          padding: "0 8px",
                          borderRadius: 8,
                          border: "1px solid " + (action.primary ? C.blue : dashBorder),
                          background: action.primary ? C.blue : "transparent",
                          color: action.primary ? "#fff" : C.t,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: action.enabled ? "pointer" : "default",
                          whiteSpace: "nowrap",
                        }}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
