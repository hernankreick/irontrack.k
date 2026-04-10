import React from "react";
import { Ic } from "./Ic.jsx";

/**
 * Drawer de bienvenida (modo alumno). Mobile-first, tema oscuro.
 * Equivalente visual a Drawer de shadcn: panel inferior, handle, overlay.
 *
 * @param {object} props
 * @param {boolean} props.open - Si el drawer está visible (el padre suele no renderizar si !open)
 * @param {(open: boolean) => void} props.onOpenChange - p.ej. (v) => !v && cerrar
 * @param {string} [props.userName] - Nombre completo del atleta
 * @param {boolean} props.es - Español / inglés
 * @param {string} props.bgCard - Fondo card (tema)
 * @param {string} props.border - Borde (tema)
 * @param {string} props.textMain
 * @param {string} props.textMuted
 */
export function WelcomeModal({
  open,
  onOpenChange,
  userName,
  es,
  bgCard,
  border,
  textMain,
  textMuted,
}) {
  if (!open) return null;

  const displayName =
    (userName && String(userName).trim()) || (es ? "Atleta" : "Athlete");

  const subtitle = es
    ? `Bienvenido/a a Iron Track, ${displayName}`
    : `Welcome to Iron Track, ${displayName}`;

  const items = [
    {
      key: "swipe",
      text: es
        ? "Deslizá → para completar cada set"
        : "Swipe → to complete each set",
      icon: (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            marginLeft: -2,
          }}
        >
          <Ic name="chevron-right" size={14} color="#2563EB" />
          <Ic
            name="chevron-right"
            size={14}
            color="#2563EB"
            style={{ marginLeft: -7 }}
          />
        </span>
      ),
    },
    {
      key: "progress",
      text: es
        ? "Seguí tu progreso y PRs"
        : "Track your progress & PRs",
      icon: <Ic name="trending-up" size={16} color="#2563EB" />,
    },
    {
      key: "trophy",
      text: es ? "Rompé tus récords 🏆" : "Break your records 🏆",
      icon: <Ic name="award" size={16} color="#2563EB" />,
    },
  ];

  const primary = "#4F80FF";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.93)",
        zIndex: 300,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={() => onOpenChange?.(false)}
      role="presentation"
    >
      <div
        style={{
          background: bgCard,
          borderRadius: "20px 20px 0 0",
          padding: "12px 24px 40px",
          width: "100%",
          maxWidth: 480,
          animation: "slideUpFade 0.35s ease",
          border: "1px solid " + border,
          borderBottom: "none",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
      >
        {/* Handle (shadcn Drawer style) */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: primary,
            margin: "0 auto 20px",
            opacity: 0.9,
          }}
        />

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              margin: "0 auto 16px",
              background: "rgba(79, 128, 255, 0.18)",
              border: "2px solid rgba(79, 128, 255, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ic name="zap" size={26} color={primary} />
          </div>
          <div
            id="welcome-modal-title"
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: textMain,
              marginBottom: 8,
              lineHeight: 1.2,
              wordBreak: "break-word",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: es ? 14 : 13,
              fontWeight: 600,
              color: textMuted,
              lineHeight: 1.45,
              maxWidth: 320,
              margin: "0 auto",
            }}
          >
            {subtitle}
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: textMain,
              marginTop: 10,
            }}
          >
            {es ? "¡Bienvenido/a!" : "Welcome!"}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          {items.map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: "rgba(37, 99, 235, 0.14)",
                  border: "2px solid rgba(37, 99, 235, 0.55)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {item.icon}
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: textMain,
                  lineHeight: 1.35,
                }}
              >
                {item.text}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="hov"
          onClick={() => onOpenChange?.(false)}
          style={{
            width: "100%",
            padding: "16px",
            background: primary,
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 900,
            cursor: "pointer",
            fontFamily: "inherit",
            letterSpacing: 1,
            boxShadow: "0 4px 20px rgba(79, 128, 255, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            textTransform: "uppercase",
          }}
        >
          <Ic name="zap" size={18} color="#fff" />
          {es ? "EMPEZAR" : "START"}
        </button>
      </div>
    </div>
  );
}
