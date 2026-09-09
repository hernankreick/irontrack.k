import React, { useMemo, useRef, useState } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { parseProgresoDate } from "../coachProgresoMetrics.js";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";

var SWIPE_CLOSE_PX = 90;

function formatSessionDate(fecha, lang) {
  var d = parseProgresoDate(fecha);
  if (!d) return String(fecha || "—");
  var locale = lang === "es" ? "es-AR" : lang === "pt" ? "pt-BR" : "en-US";
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Agrupa filas de progreso (mismo shape que progresoGlobal[alumnoId], ya cargadas en memoria)
 * por fecha de sesión. Cada fila es 1 serie; el fetch original ordena por created_at desc, así
 * que se revierte el orden dentro de cada sesión para listar los sets en orden de ejecución.
 */
function buildSessions(rows) {
  var byFecha = {};
  var order = [];
  rows.forEach(function (r) {
    var key = String(r.fecha || "");
    if (!byFecha[key]) {
      byFecha[key] = [];
      order.push(key);
    }
    byFecha[key].push(r);
  });
  var sessions = order.map(function (key) {
    var sets = byFecha[key].slice().reverse();
    var vol = 0;
    var topKg = 0;
    sets.forEach(function (r) {
      var kg = parseFloat(r.kg) || 0;
      var reps = parseInt(r.reps, 10) || 0;
      vol += kg * Math.max(1, reps);
      if (kg > topKg) topKg = kg;
    });
    var d = parseProgresoDate(key);
    return { fecha: key, dateMs: d ? d.getTime() : 0, sets: sets, vol: vol, topKg: topKg };
  });
  sessions.sort(function (a, b) {
    return b.dateMs - a.dateMs;
  });
  return sessions;
}

export default function EjercicioHistorialCoach({
  alumnoId,
  ejercicioId,
  ejercicioNombre,
  progresoGlobal,
  lang,
  onClose,
}) {
  var touchStartY = useRef(null);
  var [dragY, setDragY] = useState(0);
  var [dragging, setDragging] = useState(false);

  var sessions = useMemo(
    function () {
      var rows = (progresoGlobal && progresoGlobal[alumnoId]) || [];
      var filtered = rows.filter(function (r) {
        return String(r.ejercicio_id) === String(ejercicioId);
      });
      return buildSessions(filtered);
    },
    [progresoGlobal, alumnoId, ejercicioId]
  );

  /** Badge de header: top set de la última sesión vs. la sesión anterior (prevKg/deltaKg, mismo criterio que los eventos PR de coachProgresoMetrics.js). */
  var deltaInfo = useMemo(
    function () {
      if (sessions.length < 2) return null;
      var latest = sessions[0];
      var prev = sessions[1];
      if (latest.topKg <= 0 || prev.topKg <= 0) return null;
      return { kg: latest.topKg, prevKg: prev.topKg, deltaKg: latest.topKg - prev.topKg };
    },
    [sessions]
  );

  function handleTouchStart(e) {
    touchStartY.current = e.touches[0].clientY;
    setDragging(true);
  }
  function handleTouchMove(e) {
    if (touchStartY.current == null) return;
    var dy = e.touches[0].clientY - touchStartY.current;
    if (dy < 0) {
      setDragY(0);
      return;
    }
    setDragY(dy);
  }
  function handleTouchEnd() {
    setDragging(false);
    if (dragY > SWIPE_CLOSE_PX) onClose();
    setDragY(0);
    touchStartY.current = null;
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1100,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <style>
        {"@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');"}
      </style>
      <div
        onClick={function (e) {
          e.stopPropagation();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          background: "#0D1424",
          borderRadius: "18px 18px 0 0",
          maxHeight: "82vh",
          overflowY: "auto",
          padding: "12px 18px 28px",
          fontFamily: "'DM Sans', sans-serif",
          color: "#E5E9F2",
          boxSizing: "border-box",
          transform: "translateY(" + dragY + "px)",
          transition: dragging ? "none" : "transform 0.2s ease",
        }}
      >
        <div style={{ width: 40, height: 4, background: "#2D4057", borderRadius: 99, margin: "0 auto 14px" }} />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.06,
                textTransform: "uppercase",
                color: "#7C8AA5",
              }}
            >
              {M(lang, "Historial de ejercicio", "Exercise history")}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, wordBreak: "break-word" }}>
              {ejercicioNombre}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={M(lang, "Cerrar", "Close")}
            style={{
              background: "none",
              border: "none",
              color: "#7C8AA5",
              cursor: "pointer",
              padding: 6,
              flexShrink: 0,
              display: "flex",
            }}
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {deltaInfo ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 10,
              padding: "6px 10px",
              borderRadius: 8,
              background: deltaInfo.deltaKg >= 0 ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
              border: "1px solid " + (deltaInfo.deltaKg >= 0 ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"),
            }}
          >
            {deltaInfo.deltaKg >= 0 ? (
              <TrendingUp size={14} color="#22c55e" strokeWidth={2.5} />
            ) : (
              <TrendingDown size={14} color="#ef4444" strokeWidth={2.5} />
            )}
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 13,
                fontWeight: 600,
                color: deltaInfo.deltaKg >= 0 ? "#22c55e" : "#ef4444",
              }}
            >
              {deltaInfo.kg} kg ({deltaInfo.deltaKg >= 0 ? "+" : ""}
              {Math.round(deltaInfo.deltaKg * 10) / 10} kg)
            </span>
            <span style={{ fontSize: 11, color: "#7C8AA5" }}>
              {M(lang, "vs. sesión anterior", "vs. previous session")}
            </span>
          </div>
        ) : null}

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {sessions.length === 0 ? (
            <div style={{ fontSize: 13, color: "#7C8AA5", padding: "16px 0" }}>
              {M(lang, "Sin series registradas para este ejercicio.", "No sets logged for this exercise.")}
            </div>
          ) : (
            sessions.map(function (s) {
              return (
                <div
                  key={s.fecha}
                  style={{
                    border: "1px solid #1E2A3F",
                    borderRadius: 12,
                    padding: "12px 14px",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#C8D1E0" }}>
                      {formatSessionDate(s.fecha, lang)}
                    </span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: "#93c5fd" }}>
                      {Math.round(s.vol)} kg {M(lang, "volumen", "volume")}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {s.sets.map(function (r, i) {
                      var kg = parseFloat(r.kg) || 0;
                      var reps = parseInt(r.reps, 10) || 0;
                      return (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span style={{ color: "#7C8AA5" }}>
                            {M(lang, "Set", "Set")} {i + 1}
                          </span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
                            {kg} kg × {reps}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
