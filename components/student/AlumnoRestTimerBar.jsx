import React, { memo, useEffect, useMemo, useState } from 'react';

/** Barra de pausa del alumno (fuera de sesión): el countdown vive aquí para no re-renderizar GymApp cada tick. */
const AlumnoRestTimerBar = memo(function AlumnoRestTimerBar({ timer, onCancel, bgSub, darkMode, textMuted, btn, fmt }) {
  const R = 26;
  const circ = 2 * Math.PI * R;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!timer?.endAt) return;
    const id = setInterval(() => setTick(function (t) { return t + 1; }), 250);
    return function () { clearInterval(id); };
  }, [timer?.endAt]);
  const remaining = useMemo(
    () => (timer?.endAt ? Math.max(0, Math.round((timer.endAt - Date.now()) / 1000)) : 0),
    [timer?.endAt, tick]
  );
  const borderCol = darkMode ? "#2D4057" : "#2D4057";
  return (
    <div style={{ background: bgSub, borderBottom: "1px solid " + borderCol, padding: "8px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <svg width={52} height={52} style={{ flexShrink: 0 }}>
        <circle cx={26} cy={26} r={R} fill="none" stroke="#2D4057" strokeWidth={3} />
        <circle cx={26} cy={26} r={R} fill="none" stroke={remaining < 10 ? "#2563EB" : timer.color || "#22C55E"} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - remaining / timer.total)}
          style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset .8s" }} />
        <text x={26} y={30} textAnchor="middle" fill="#FFFFFF" fontSize={13} fontWeight={700}>{fmt(remaining)}</text>
      </svg>
      <span style={{ color: textMuted, fontSize: 15, flex: 1 }}>Pausa activa</span>
      <button type="button" className="hov" style={{ ...btn("#2563EB33"), color: "#2563EB", padding: "4px 8px", fontSize: 15 }} onClick={onCancel}>Cancelar</button>
    </div>
  );
});

export default AlumnoRestTimerBar;
