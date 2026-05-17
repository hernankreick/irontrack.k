import React from 'react';
import BaseModal from '../modals/BaseModal.jsx';

export default function DuplicateDayModal({
  dupDayModal,
  dupDayClosing,
  bgSub,
  border,
  textMain,
  textMuted,
  msg,
  onClose,
  onToggleDay,
  onConfirm,
}) {
  if (!dupDayModal) return null;

  return (
    <BaseModal open={!!dupDayModal && !dupDayClosing} onClose={onClose} maxWidth={480}>
      <div style={{ fontSize: 18, fontWeight: 800, color: textMain, marginBottom: 4 }}>
        {msg("Duplicar", "Duplicate")} {dupDayModal.days[dupDayModal.dIdx]?.label || ("Día " + (dupDayModal.dIdx + 1))}
      </div>
      <div style={{ fontSize: 13, color: textMuted, marginBottom: 16 }}>
        {msg("Seleccioná los días destino", "Select destination days")}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {dupDayModal.days.map(function (d, di) {
          if (di === dupDayModal.dIdx) return (
            <div key={"dup-day-src-" + dupDayModal.dIdx + "-mark-" + di} style={{ padding: "10px 16px", borderRadius: 12, background: "#2563EB22", border: "2px solid #2563EB", opacity: 0.5 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#2563EB" }}>{d.label || ("Día " + (di + 1))}</div>
              <div style={{ fontSize: 10, color: textMuted }}>{msg("Origen", "Source")}</div>
            </div>
          );
          var isSelected = dupDayModal.selected.indexOf(di) !== -1;
          var tieneEj = ((d.warmup || []).length + (d.exercises || []).length) > 0;
          return (
            <div key={"dup-day-pick-" + dupDayModal.dIdx + "-to-" + di} onClick={function () { onToggleDay(di); }} style={{
              padding: "10px 16px", borderRadius: 12, cursor: "pointer", transition: "all .15s",
              background: isSelected ? "#22C55E22" : bgSub,
              border: isSelected ? "2px solid #22C55E" : "2px solid " + border
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: isSelected ? "#22C55E" : textMain }}>{d.label || ("Día " + (di + 1))}</div>
              <div style={{ fontSize: 10, color: textMuted }}>
                {tieneEj ? ((d.warmup || []).length + (d.exercises || []).length) + " ej." : "vacío"}
              </div>
              {isSelected && <div style={{ fontSize: 10, fontWeight: 700, color: "#22C55E", marginTop: 2 }}>✓ {msg("Seleccionado", "Selected")}</div>}
            </div>
          );
        })}
      </div>
      {dupDayModal.selected.some(function (di) { return ((dupDayModal.days[di]?.warmup || []).length + (dupDayModal.days[di]?.exercises || []).length) > 0; }) && (
        <div style={{ background: "#F59E0B12", border: "1px solid #F59E0B33", borderRadius: 8, padding: "8px 10px", marginBottom: 12, fontSize: 12, color: "#F59E0B" }}>
          ⚠ {msg("Algunos días seleccionados tienen ejercicios. Se reemplazarán.", "Some selected days have exercises. They will be replaced.")}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: 12, background: bgSub, color: textMuted, border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{msg("CANCELAR", "CANCEL")}</button>
        <button onClick={onConfirm} style={{ flex: 1, padding: 12, background: (dupDayModal.selected.length > 0 || (Array.isArray(dupDayModal.days) && dupDayModal.days.length === 1)) ? "#2563EB" : "#2D4057", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
          {msg("DUPLICAR", "DUPLICATE")} {dupDayModal.selected.length > 0 && ("(" + dupDayModal.selected.length + ")")}
        </button>
      </div>
    </BaseModal>
  );
}
