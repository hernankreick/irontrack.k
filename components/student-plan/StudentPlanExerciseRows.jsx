import React from "react";
import { resolveExerciseTitle } from "../../lib/exerciseResolve.js";
import { Ic } from "../Ic.jsx";

function cleanKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function firstText() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function resolveExImg(info, ex, images, title) {
  var direct = firstText(
    ex && (ex.image || ex.image_url || ex.img || ex.thumbnail || ex.thumbnail_url),
    info && (info.image || info.image_url || info.img || info.thumbnail || info.thumbnail_url)
  );
  if (direct) return direct;
  var map = images || {};
  var ids = [ex && ex.id, info && info.id].filter(Boolean);
  for (var i = 0; i < ids.length; i++) {
    if (map[ids[i]]) return map[ids[i]];
  }
  var normalized = {};
  Object.keys(map).forEach(function (key) { normalized[cleanKey(key)] = map[key]; });
  var candidates = [
    ex && ex.slug, info && info.slug, title,
    ex && (ex.name || ex.nombre || ex.nameEn),
    info && (info.name || info.nombre || info.nameEn),
  ];
  for (var j = 0; j < candidates.length; j++) {
    var k = cleanKey(candidates[j]);
    if (k && normalized[k]) return normalized[k];
  }
  return "";
}

function ExThumb({ src, name }) {
  return (
    <div style={{
      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
      background: "rgba(37,99,235,0.10)",
      border: "1px solid rgba(96,165,250,0.22)",
      overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {src ? (
        <img src={src} alt={name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <Ic name="dumbbell" size={22} color="#2563EB" strokeWidth={1.9} />
      )}
    </div>
  );
}

export default function StudentPlanExerciseRows({
  day,
  routineId,
  dayIndex,
  allEx,
  currentWeekForRoutine,
  border,
  textMain,
  msg,
  es,
  fmtP,
  images,
  renderExerciseVideoButton,
}) {
  return (
    <>
      {(day.warmup || []).length > 0 && (
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 3, height: 12, borderRadius: 2, background: "#F59E0B" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", letterSpacing: 1 }}>{msg("ENTRADA EN CALOR", "WARM-UP")}</span>
          </div>
          {(day.warmup || []).map(function (ex, ei) {
            var inf = allEx.find(function (e) { return e.id === ex.id; });
            var nombre = resolveExerciseTitle(inf || null, ex, es);
            var imgSrc = images ? resolveExImg(inf || null, ex, images, nombre) : "";
            return (
              <div key={routineId + "-d" + dayIndex + "-wu-" + (ex.id || "ex") + "-" + ei} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0", borderBottom: ei < (day.warmup || []).length - 1 ? "1px solid " + border : "none" }}>
                <div style={{ width: 3, height: 20, borderRadius: 2, background: "#F59E0B44", flexShrink: 0 }} />
                {images && <ExThumb src={imgSrc} name={nombre} />}
                <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: textMain }}>{nombre}</div>
                <span style={{ fontSize: 13, color: "#A3B4CC", fontWeight: 600 }}>{ex.sets || "-"}×{ex.reps || "-"}</span>
                {renderExerciseVideoButton(inf, ex, nombre)}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ width: 3, height: 12, borderRadius: 2, background: "#2563EB" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", letterSpacing: 1 }}>{msg("BLOQUE PRINCIPAL", "MAIN BLOCK")}</span>
        </div>
        {day.exercises.map(function (ex, ei) {
          var inf = allEx.find(function (e) { return e.id === ex.id; });
          var nombre = resolveExerciseTitle(inf || null, ex, es);
          var w = ((ex.weeks || [])[currentWeekForRoutine]) || {};
          var s = w.sets || ex.sets || "-";
          var rp = w.reps || ex.reps || "-";
          var kg2 = w.kg || ex.kg || "";
          var imgSrc = images ? resolveExImg(inf || null, ex, images, nombre) : "";
          return (
            <div key={routineId + "-d" + dayIndex + "-ex-" + (ex.id || "ex") + "-" + ei} style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", borderBottom: ei < day.exercises.length - 1 ? "1px solid " + border : "none" }}>
              <div style={{ width: 3, height: 24, borderRadius: 2, background: border, flexShrink: 0 }} />
              {images && <ExThumb src={imgSrc} name={nombre} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: textMain }}>{nombre}</div>
                <div style={{ fontSize: 13, color: "#A3B4CC", fontWeight: 500, marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700 }}>{s}×{rp}</span>{kg2 && <span>{kg2}kg</span>}{ex.pause && fmtP && <span>⏱ {fmtP(ex.pause)}</span>}
                </div>
              </div>
              {renderExerciseVideoButton(inf, ex, nombre)}
            </div>
          );
        })}
      </div>
    </>
  );
}
