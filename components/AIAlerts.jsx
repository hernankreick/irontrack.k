import AlertCard from "./ai-alerts/AlertCard.jsx";

function AiAlertsKeyframes() {
  return (
    <style>
      {`
        @keyframes aiAlertsFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}
    </style>
  );
}

const C = {
  bg: "#0B0E11",
  card: "#141920",
  border: "rgba(255,255,255,0.06)",
  blue: "#2563EB",
  blue2: "#3B82F6",
  blueDim: "rgba(37,99,235,0.13)",
  green: "#22C55E",
  greenDim: "rgba(34,197,94,0.11)",
  red: "#EF4444",
  redDim: "rgba(239,68,68,0.11)",
  amber: "#F59E0B",
  amberDim: "rgba(245,158,11,0.11)",
  text: "#F0F4F8",
  text2: "#8899AA",
  text3: "#445566",
  bg3: "#141920",
  r: 14,
  rSm: 9,
};

function IconSectionAi() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconRiskWarning() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconAiChipSmall() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

function FactorIcon({ type }) {
  const common = { width: 10, height: 10, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  switch (type) {
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "message":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "repeat":
      return (
        <svg {...common}>
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );
    case "trend":
      return (
        <svg {...common}>
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <polyline points="17 18 23 18 23 12" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case "clock":
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
  }
}

function ActionIcon({ name }) {
  const common = { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  switch (name) {
    case "message":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "profile":
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "routine":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case "congrats":
      return (
        <svg {...common}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    default:
      return null;
  }
}

const riskBadgeStyle = {
  h: {
    background: C.redDim,
    color: C.red,
    border: "1px solid rgba(239,68,68,.2)",
  },
  m: {
    background: C.amberDim,
    color: C.amber,
    border: "1px solid rgba(245,158,11,.2)",
  },
  p: {
    background: C.greenDim,
    color: C.green,
    border: "1px solid rgba(34,197,94,.2)",
  },
};

/**
 * Sección Alertas IA — datos vía props.
 *
 * @param {object} props
 * @param {string} [props.sectionTitle]
 * @param {number|null} [props.urgentCount] — si es null/undefined, no se muestra badge
 * @param {string} [props.urgentBadgeLabel]
 * @param {string} [props.viewAllLabel]
 * @param {() => void} [props.onViewAll]
 * @param {Array} props.alerts — ver tipos en el código (initials, level, risk, factors, etc.)
 * @param {(id: string) => void} [props.onPrimaryAction]
 * @param {(id: string) => void} [props.onSecondaryAction]
 */
export default function AIAlerts({
  sectionTitle = "Alertas IA",
  urgentCount = null,
  urgentBadgeLabel = "urgentes",
  viewAllLabel = "Ver todas",
  onViewAll,
  alerts = [],
  onPrimaryAction,
  onSecondaryAction,
}) {
  return (
    <>
      <AiAlertsKeyframes />
    <div style={{ marginTop: 24, animation: "aiAlertsFadeUp .4s ease both", animationDelay: "0.08s" }}>
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

      {alerts.map((a) => (
        <AlertCard
          key={a.id}
          alert={a}
          C={C}
          riskBadgeStyle={riskBadgeStyle}
          onPrimaryAction={onPrimaryAction}
          onSecondaryAction={onSecondaryAction}
          IconActivity={IconActivity}
          IconCheck={IconCheck}
          IconRiskWarning={IconRiskWarning}
          FactorIcon={FactorIcon}
          IconAiChipSmall={IconAiChipSmall}
          ActionIcon={ActionIcon}
        />
      ))}
    </div>
    </>
  );
}

export { C as aiAlertsColors };
