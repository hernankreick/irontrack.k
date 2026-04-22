import React from "react";

const ICON_PX = 19;

/** Botón de video discreto para tarjetas de ejercicio (modo alumno). */
export function ExerciseVideoPlayButton({
  hasVideo,
  onClick,
  ariaLabel = "Ver video del ejercicio",
  ariaLabelDisabled = "Video no disponible",
}) {
  const [hover, setHover] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const [focusVisible, setFocusVisible] = React.useState(false);

  const interactive = !!hasVideo;

  let background;
  let border;
  let boxShadow = "none";

  if (!interactive) {
    background = "rgba(255,255,255,0.02)";
    border = "1px solid rgba(255,255,255,0.05)";
  } else if (hover || pressed) {
    background = "rgba(37, 99, 235, 0.15)";
    border = "1px solid rgba(37, 99, 235, 0.35)";
    boxShadow = "0 6px 14px rgba(37, 99, 235, 0.18)";
  } else {
    background = "rgba(255,255,255,0.04)";
    border = "1px solid rgba(255,255,255,0.08)";
  }

  if (interactive && focusVisible && !hover && !pressed) {
    boxShadow = "0 0 0 2px rgba(37, 99, 235, 0.45)";
  }

  const transform = interactive && pressed ? "scale(0.96)" : "scale(1)";

  return (
    <button
      type="button"
      disabled={!interactive}
      aria-label={interactive ? ariaLabel : ariaLabelDisabled}
      aria-disabled={!interactive}
      onClick={function (e) {
        if (!interactive) return;
        if (onClick) onClick(e);
      }}
      onMouseEnter={function () {
        if (interactive) setHover(true);
      }}
      onMouseLeave={function () {
        setHover(false);
        setPressed(false);
      }}
      onMouseDown={function (e) {
        if (!interactive) return;
        if (e.button === 0) setPressed(true);
      }}
      onMouseUp={function () {
        setPressed(false);
      }}
      onTouchStart={function () {
        if (interactive) setPressed(true);
      }}
      onTouchEnd={function () {
        setPressed(false);
      }}
      onTouchCancel={function () {
        setPressed(false);
      }}
      onFocus={function (e) {
        if (!interactive) return;
        try {
          if (e.currentTarget.matches(":focus-visible")) setFocusVisible(true);
        } catch (_err) {
          /* ignore */
        }
      }}
      onBlur={function () {
        setFocusVisible(false);
      }}
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        padding: 0,
        margin: 0,
        boxSizing: "border-box",
        fontFamily: "inherit",
        WebkitTapHighlightColor: "transparent",
        cursor: interactive ? "pointer" : "default",
        transition: "all 160ms ease",
        background: background,
        border: border,
        boxShadow: boxShadow,
        transform: transform,
        WebkitBackdropFilter: "blur(10px)",
        backdropFilter: "blur(10px)",
        color: "#E6EEF8",
        outline: "none",
      }}
    >
      <svg
        width={ICON_PX}
        height={ICON_PX}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        style={{
          display: "block",
          marginLeft: 2,
          opacity: interactive ? 1 : 0.35,
        }}
      >
        <polygon points="8 5 19 12 8 19 8 5" />
      </svg>
    </button>
  );
}
