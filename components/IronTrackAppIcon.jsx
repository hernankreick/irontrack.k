import React from "react";

const OFFICIAL_ICON_SRC = "/icon-1024.png";
// Variante opt-in: isotipo recortado sin la baldosa cuadrada del ícono de app (512x512, alfa 0 fuera del círculo).
const ISOTIPO_SRC = "/isotipo-onboarding.png";

export default function IronTrackAppIcon({
  size = 96,
  className,
  style,
  "aria-label": ariaLabel,
  animated: _animated,
  variant,
  ...rest
}) {
  return (
    <img
      src={variant === "isotipo" ? ISOTIPO_SRC : OFFICIAL_ICON_SRC}
      {...(variant === "isotipo" ? { width: 512, height: 512 } : null)}
      alt={ariaLabel != null && ariaLabel !== "" ? ariaLabel : "IronTrack"}
      className={className}
      draggable={false}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        display: "block",
        objectFit: "contain",
        flexShrink: 0,
        ...style,
      }}
      {...rest}
    />
  );
}
