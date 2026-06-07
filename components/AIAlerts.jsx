import AlertCard from "./ai-alerts/AlertCard.jsx";
import AIAlertsHeader from "./ai-alerts/AIAlertsHeader.jsx";
import {
  ActionIcon,
  FactorIcon,
  IconActivity,
  IconAiChipSmall,
  IconCheck,
  IconRiskWarning,
  IconSectionAi,
} from "./ai-alerts/aiAlertIcons.jsx";

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
      <AIAlertsHeader
        sectionTitle={sectionTitle}
        urgentCount={urgentCount}
        urgentBadgeLabel={urgentBadgeLabel}
        viewAllLabel={viewAllLabel}
        onViewAll={onViewAll}
        C={C}
        IconSectionAi={IconSectionAi}
      />

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
