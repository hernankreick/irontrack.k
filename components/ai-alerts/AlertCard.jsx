import { useState } from "react";

export default function AlertCard({
  alert,
  C,
  riskBadgeStyle,
  onPrimaryAction,
  onSecondaryAction,
  IconActivity,
  IconCheck,
  IconRiskWarning,
  FactorIcon,
  IconAiChipSmall,
  ActionIcon,
}) {
  const [open, setOpen] = useState(false);
  const {
    id,
    level,
    initials,
    avatarStyle,
    name,
    contextLine,
    patternQuote,
    risk,
    factors,
    suggestion,
    primaryAction,
    secondaryAction,
    highlightedBorder,
  } = alert;

  const leftBar =
    level === "high" ? C.red : level === "med" ? C.amber : C.green;

  const cardBorder = highlightedBorder ? "rgba(34,197,94,.18)" : C.border;

  const suggestDefault = {
    background: "rgba(37,99,235,.1)",
    border: "1px solid rgba(59,130,246,.18)",
    color: "#90B8F8",
  };
  const suggestPositive = {
    background: "rgba(34,197,94,.08)",
    border: "1px solid rgba(34,197,94,.2)",
    color: "#6EE7A0",
  };
  const suggestStyle = suggestion.tone === "positive" ? suggestPositive : suggestDefault;
  const aiTagColor = suggestion.tone === "positive" ? C.green : C.blue2;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
      style={{
        background: C.card,
        border: `1px solid ${cardBorder}`,
        borderRadius: C.r,
        padding: 14,
        marginBottom: 9,
        cursor: "pointer",
        transition: "border-color .18s, box-shadow .18s",
        position: "relative",
        overflow: "hidden",
        boxShadow: open ? `0 0 0 1px ${C.blue2}` : "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: leftBar,
        }}
      />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
            background: avatarStyle?.background,
            color: avatarStyle?.color,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{name}</div>
          <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{contextLine}</div>
          {patternQuote ? (
            <div
              style={{
                fontSize: 11,
                color: C.text2,
                marginTop: 6,
                fontStyle: "italic",
                display: "flex",
                alignItems: "flex-start",
                gap: 5,
                lineHeight: 1.4,
              }}
            >
              <IconActivity />
              {patternQuote}
            </div>
          ) : null}
        </div>
        <div
          style={{
            flexShrink: 0,
            borderRadius: 20,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 4,
            whiteSpace: "nowrap",
            ...riskBadgeStyle[risk.badgeVariant],
          }}
        >
          {risk.kind === "pr" ? <IconCheck /> : <IconRiskWarning />}
          {risk.value}
        </div>
      </div>

      {factors?.length ? (
        <div
          style={{
            display: open ? "flex" : "none",
            flexWrap: "wrap",
            gap: 5,
            marginTop: 11,
            paddingTop: 11,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          {factors.map((f, i) => (
            <span
              key={`${id}-f-${i}`}
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: C.text2,
                background: C.bg3,
                border: `1px solid ${C.border}`,
                borderRadius: 20,
                padding: "3px 9px",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <FactorIcon type={f.icon || "clock"} />
              {f.label}
            </span>
          ))}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 10,
          ...suggestStyle,
          borderRadius: C.rSm,
          padding: "9px 11px",
          fontSize: 11,
          lineHeight: 1.55,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.8px",
            textTransform: "uppercase",
            color: aiTagColor,
            marginRight: 5,
          }}
        >
          <IconAiChipSmall />
          IA sugiere
        </span>
        {suggestion.text}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          style={{
            flex: 1,
            minHeight: 44,
            padding: "10px 8px",
            borderRadius: C.rSm,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            cursor: "pointer",
            border: "none",
            textAlign: "center",
            transition: "opacity .15s, transform .1s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            background: C.blue,
            color: "#fff",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onPrimaryAction?.(id);
          }}
        >
          {primaryAction.icon ? <ActionIcon name={primaryAction.icon} /> : null}
          {primaryAction.label}
        </button>
        <button
          type="button"
          style={{
            flex: 1,
            minHeight: 44,
            padding: "10px 8px",
            borderRadius: C.rSm,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            cursor: "pointer",
            textAlign: "center",
            transition: "opacity .15s, transform .1s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            background: C.bg3,
            color: C.text2,
            border: `1px solid ${C.border}`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSecondaryAction?.(id);
          }}
        >
          {secondaryAction.icon ? <ActionIcon name={secondaryAction.icon} /> : null}
          {secondaryAction.label}
        </button>
      </div>
    </div>
  );
}
