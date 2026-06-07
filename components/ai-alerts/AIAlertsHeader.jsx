export default function AIAlertsHeader({
  sectionTitle,
  urgentCount,
  urgentBadgeLabel,
  viewAllLabel,
  onViewAll,
  C,
  IconSectionAi,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "1.8px",
          textTransform: "uppercase",
          color: C.text3,
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <IconSectionAi />
        {sectionTitle}
        {urgentCount != null && urgentCount > 0 ? (
          <span
            style={{
              background: C.redDim,
              color: C.red,
              border: "1px solid rgba(239,68,68,.2)",
              borderRadius: 20,
              padding: "2px 7px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.4px",
            }}
          >
            {urgentCount} {urgentBadgeLabel}
          </span>
        ) : null}
      </div>
      {onViewAll ? (
        <button
          type="button"
          onClick={onViewAll}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.blue2,
            cursor: "pointer",
            letterSpacing: "0.3px",
            background: "none",
            border: "none",
            minHeight: 44,
            padding: "6px 4px",
          }}
        >
          {viewAllLabel}
        </button>
      ) : (
        <span style={{ fontSize: 11, fontWeight: 600, color: C.blue2, letterSpacing: "0.3px" }}>{viewAllLabel}</span>
      )}
    </div>
  );
}
