import React from "react";
import { Ic } from "../Ic.jsx";
import { resolveExerciseTitle, resolveVideoUrl } from "../../lib/exerciseResolve.js";

function cleanKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function firstText() {
  for (let i = 0; i < arguments.length; i++) {
    const v = arguments[i];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function resolveExerciseImage(info, ex, images, title) {
  const direct = firstText(
    ex && (ex.image || ex.image_url || ex.img || ex.thumbnail || ex.thumbnail_url),
    info && (info.image || info.image_url || info.img || info.thumbnail || info.thumbnail_url)
  );
  if (direct) return direct;

  const map = images || {};
  const ids = [ex && ex.id, info && info.id].filter(Boolean);
  for (let i = 0; i < ids.length; i++) {
    if (map[ids[i]]) return map[ids[i]];
  }

  const normalized = {};
  Object.keys(map).forEach(function (key) {
    normalized[cleanKey(key)] = map[key];
  });
  const candidates = [
    ex && ex.slug,
    info && info.slug,
    title,
    ex && (ex.name || ex.nombre || ex.nameEn),
    info && (info.name || info.nombre || info.nameEn),
  ];
  for (let i = 0; i < candidates.length; i++) {
    const key = cleanKey(candidates[i]);
    if (key && normalized[key]) return normalized[key];
  }
  return "";
}

export function TodayWorkoutList({
  msg,
  day,
  allEx,
  images,
  currentWeek,
  es,
  videoOverrides,
  textMain,
  textMuted,
  border,
  onExerciseVideo,
}) {
  const main = (day && day.exercises) || [];
  const warmup = (day && day.warmup) || [];
  const exercises = main.length ? main : warmup;
  if (!exercises.length) return null;

  return (
    <section style={{ marginTop: 18, paddingBottom: 8 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: 1.1,
          color: textMain,
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {msg("TU ENTRENAMIENTO DE HOY", "TODAY'S WORKOUT", "SEU TREINO DE HOJE")}
      </div>
      <div
        style={{
          background: "rgba(13,20,36,0.84)",
          border: "1px solid " + border,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {exercises.map(function (ex, index) {
          const info = (allEx || []).find(function (e) {
            return e.id === ex.id;
          });
          const name = resolveExerciseTitle(info || null, ex, es);
          const imageSrc = resolveExerciseImage(info || null, ex, images, name);
          const videoUrl = resolveVideoUrl(info || null, ex, videoOverrides);
          const week = ((ex.weeks || [])[currentWeek]) || {};
          const sets = week.sets || ex.sets || "-";
          const reps = week.reps || ex.reps || "-";
          const canOpen = !!(videoUrl && onExerciseVideo);
          const row = (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 12px",
                borderBottom: index < exercises.length - 1 ? "1px solid " + border : "none",
                minHeight: 70,
                boxSizing: "border-box",
              }}
            >
              <div
                className="num"
                style={{
                  width: 22,
                  flexShrink: 0,
                  color: "#64748B",
                  fontSize: 12,
                  fontWeight: 900,
                  textAlign: "center",
                }}
              >
                {index + 1}
              </div>
              <ExerciseThumb src={imageSrc} name={name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 850,
                    color: textMain,
                    lineHeight: 1.22,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: textMuted,
                    fontWeight: 700,
                    lineHeight: 1.25,
                  }}
                >
                  {sets}x{reps}
                </div>
              </div>
              <Ic name="chevron-right" size={18} color={canOpen ? "#94A3B8" : "#475569"} />
            </div>
          );
          return canOpen ? (
            <button
              key={(ex.id || "ex") + "-" + index}
              type="button"
              className="hov"
              onClick={function () {
                onExerciseVideo(name, videoUrl);
              }}
              style={{
                width: "100%",
                padding: 0,
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
                color: "inherit",
              }}
            >
              {row}
            </button>
          ) : (
            <div key={(ex.id || "ex") + "-" + index}>{row}</div>
          );
        })}
      </div>
    </section>
  );
}

function ExerciseThumb({ src, name }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        flexShrink: 0,
        background: "rgba(37,99,235,0.10)",
        border: "1px solid rgba(96,165,250,0.22)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <Ic name="dumbbell" size={22} color="#2563EB" strokeWidth={1.9} />
      )}
    </div>
  );
}
