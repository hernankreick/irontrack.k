import React from 'react';
import { Ic } from '../Ic.jsx';
import { getTheme } from '../../lib/uiHelpers.js';

function PagoAlumno({aliasData, es, toast2, darkMode, msg}) {
  const {bg, bgCard, bgSub, border, textMain, textMuted} = getTheme(darkMode);
  const [pagoVisible, setPagoVisible] = React.useState(() =>
    localStorage.getItem("it_pago_cerrado") !== "true"
  );
  const [copied, setCopied] = React.useState(false);

  if (!pagoVisible) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(aliasData.alias);
    setCopied(true);
    toast2(msg("Alias copiado ✓", "Alias copied ✓"));
    setTimeout(() => setCopied(false), 2000);
  };

  const infoGradient = darkMode
    ? "linear-gradient(165deg, rgba(34,197,94,.22) 0%, #0a1610 42%, rgba(21,128,61,.28) 100%)"
    : "linear-gradient(165deg, rgba(34,197,94,.2) 0%, rgba(236,253,245,.98) 45%, rgba(167,243,208,.55) 100%)";
  const aliasLineColor = darkMode ? "#fff" : "#0f1923";
  const metaLineColor = darkMode ? "rgba(220,252,231,.78)" : "#475569";
  const bancoLineColor = darkMode ? "rgba(230,245,235,.92)" : "#0a0a0a";
  const montoLineColor = darkMode ? "#4ade80" : "#166534";

  return (
    <div style={{
      background: bgCard,
      border: "1px solid rgba(34,197,94,.25)",
      borderRadius: 14,
      marginBottom: 12,
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px 8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>
            {msg("Datos de pago", "Payment info")}
          </span>
        </div>
        <button
          onClick={() => { setPagoVisible(false); localStorage.setItem("it_pago_cerrado", "true"); }}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: textMuted, width: 28, height: 28, borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Ic name="x" size={14} />
        </button>
      </div>
      <div style={{ padding: "0 14px 14px" }}>
        <div style={{
          background: infoGradient,
          border: "1px solid rgba(34,197,94,.22)",
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 10,
          boxShadow: darkMode ? "inset 0 1px 0 rgba(255,255,255,.06)" : "inset 0 1px 0 rgba(255,255,255,.5)",
        }}>
          {aliasData.banco && (
            <div style={{ fontSize: 11, color: bancoLineColor, marginBottom: 2 }}>{aliasData.banco}</div>
          )}
          <div style={{ fontSize: 20, fontWeight: 800, color: aliasLineColor, marginBottom: 2 }}>{aliasData.alias}</div>
          {aliasData.cbu && (
            <div style={{ fontSize: 11, color: metaLineColor, marginBottom: 2 }}>{aliasData.cbu}</div>
          )}
          {aliasData.monto && (
            <div style={{ fontSize: 14, fontWeight: 700, color: montoLineColor, marginBottom: 2 }}>{aliasData.monto}/mes</div>
          )}
          {aliasData.nota && (
            <div style={{ fontSize: 11, color: metaLineColor }}>{aliasData.nota}</div>
          )}
        </div>
        <button
          className="hov"
          onClick={handleCopy}
          style={{
            width: "100%", padding: "10px",
            background: copied ? "rgba(34,197,94,.2)" : "rgba(34,197,94,.1)",
            border: "1px solid rgba(34,197,94,.2)",
            borderRadius: 10,
            color: copied ? "#fff" : "#22C55E",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "background-color .2s ease,border-color .2s ease,color .2s ease,opacity .2s ease,transform .2s ease",
          }}
        >
          {copied
            ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> {msg("¡Copiado!", "Copied!")}</>
            : <><Ic name="copy" size={14}/> {msg("Copiar alias", "Copy alias")}</>
          }
        </button>
      </div>
    </div>
  );
}

export default PagoAlumno;
