import React from "react";

const OFFICIAL_ICON_SRC = "/icon-1024.png";

export default function IronTrackAppIcon({
  size = 96,
  className,
  style,
  "aria-label": ariaLabel,
  animated: _animated,
  ...rest
}) {
  return (
    <img
      src={OFFICIAL_ICON_SRC}
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
