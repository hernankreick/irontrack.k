import React from "react";
import { ChevronDown, ClipboardList, Dumbbell, Plus, UserPlus } from "lucide-react";
import { irontrackMsg as M } from "../lib/irontrackMsg.js";

const DS = {
  primary: "#3b82f6",
  card: "#12121a",
  border: "#1e1e2e",
  text: "#ffffff",
  muted: "#71717a",
  hoverBg: "rgba(59, 130, 246, 0.12)",
};

function useMinWidth(minPx) {
  const q = "(min-width: " + minPx + "px)";
  const [matches, setMatches] = React.useState(function () {
    if (typeof window === "undefined") return true;
    return window.matchMedia(q).matches;
  });
  React.useEffect(
    function () {
      if (typeof window === "undefined") return undefined;
      var mq = window.matchMedia(q);
      function onChange() {
        setMatches(mq.matches);
      }
      mq.addEventListener("change", onChange);
      setMatches(mq.matches);
      return function () {
        mq.removeEventListener("change", onChange);
      };
    },
    [q]
  );
  return matches;
}

/**
 * Botón "Crear" con menú (desktop, min-width 1024px por defecto).
 * En viewport más angosto muestra el mismo botón y delega en onNuevaRutina (sin romper layout),
 * salvo que alwaysShowDropdown fuerce el menú completo (p. ej. CoachDashboard).
 *
 * Opcional: triggerStyle / label / plusSize / showChevron para integrar otro diseño de botón.
 */
export default function GlobalCreateMenu({
  onNuevoAlumno,
  onNuevaRutina,
  onNuevoEjercicio,
  triggerStyle,
  showChevron = true,
  plusSize = 16,
  label: labelProp,
  /** es | en | pt — textos del menú desplegable */
  lang = "es",
  /** Si true, siempre muestra el dropdown (no solo rutina en &lt;1024). */
  alwaysShowDropdown = false,
}) {
  var label = labelProp != null ? labelProp : M(lang, "CREAR", "CREATE", "CRIAR");
  var isDesktop = useMinWidth(1024);
  var showMenuUi = alwaysShowDropdown || isDesktop;
  var uid = React.useId().replace(/:/g, "");
  var btnId = "global-create-btn-" + uid;
  var menuId = "global-create-dropdown-" + uid;
  var [open, setOpen] = React.useState(false);
  var [focusedIdx, setFocusedIdx] = React.useState(0);
  var wrapRef = React.useRef(null);
  var btnRef = React.useRef(null);
  var menuRef = React.useRef(null);
  var itemRefs = React.useRef([]);

  var items = React.useMemo(
    function () {
      return [
        {
          id: "alumno",
          label: M(lang, "Nuevo alumno", "New athlete", "Novo aluno"),
          Icon: UserPlus,
          action: onNuevoAlumno,
        },
        {
          id: "rutina",
          label: M(lang, "Nueva rutina", "New routine", "Nova rotina"),
          Icon: ClipboardList,
          action: onNuevaRutina,
        },
        {
          id: "ejercicio",
          label: M(lang, "Nuevo ejercicio", "New exercise", "Novo exercício"),
          Icon: Dumbbell,
          action: onNuevoEjercicio,
        },
      ];
    },
    [lang, onNuevoAlumno, onNuevaRutina, onNuevoEjercicio]
  );

  React.useEffect(
    function () {
      if (!open) return undefined;
      function onDocMouseDown(e) {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) {
          setOpen(false);
        }
      }
      function onKey(e) {
        if (e.key === "Escape") {
          setOpen(false);
          if (btnRef.current) btnRef.current.focus();
        }
      }
      document.addEventListener("mousedown", onDocMouseDown);
      document.addEventListener("keydown", onKey);
      return function () {
        document.removeEventListener("mousedown", onDocMouseDown);
        document.removeEventListener("keydown", onKey);
      };
    },
    [open]
  );

  React.useLayoutEffect(
    function () {
      if (!open || !showMenuUi) return;
      var el = itemRefs.current[focusedIdx];
      if (el && typeof el.focus === "function") el.focus();
    },
    [open, focusedIdx, showMenuUi]
  );

  function runAndClose(idx) {
    var it = items[idx];
    if (it && typeof it.action === "function") it.action();
    setOpen(false);
    if (btnRef.current) btnRef.current.focus();
  }

  function onTriggerKeyDown(e) {
    if (!showMenuUi) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setFocusedIdx(0);
        setOpen(true);
      }
    }
  }

  function onMenuKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx(function (i) {
        return (i + 1) % items.length;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx(function (i) {
        return (i - 1 + items.length) % items.length;
      });
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusedIdx(items.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAndClose(focusedIdx);
    }
  }

  var btnStyleDefault = {
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontWeight: 700,
    background: DS.primary,
    color: "#fff",
    padding: "13px 18px",
    fontSize: 13,
    borderRadius: 14,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "none",
    cursor: "pointer",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };
  var btnStyle = triggerStyle ? triggerStyle : btnStyleDefault;

  if (!showMenuUi) {
    return (
      <button
        type="button"
        style={btnStyle}
        onClick={function () {
          if (typeof onNuevaRutina === "function") onNuevaRutina();
        }}
      >
        <Plus size={plusSize} strokeWidth={2.5} aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={btnRef}
        type="button"
        id={btnId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        style={btnStyle}
        onClick={function () {
          setOpen(function (o) {
            return !o;
          });
          setFocusedIdx(0);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <Plus size={plusSize} strokeWidth={2.5} aria-hidden />
        {label}
        {showChevron ? (
          <ChevronDown
            size={16}
            aria-hidden
            style={{
              opacity: 0.9,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.18s ease",
            }}
          />
        ) : null}
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={btnId}
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            minWidth: 260,
            padding: "8px 0",
            background: DS.card,
            border: "1px solid " + DS.border,
            borderRadius: 16,
            boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
            zIndex: 200,
            animation: "globalCreateMenuIn 0.16s ease-out",
          }}
        >
          <style>
            {
              "@keyframes globalCreateMenuIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } } " +
                "#" +
                menuId +
                " button:focus-visible { outline: 2px solid #3B82F6; outline-offset: -2px; } " +
                "#" +
                btnId +
                ":focus-visible { outline: 2px solid #3B82F6; outline-offset: 2px; }"
            }
          </style>
          {items.map(function (it, idx) {
            var Icon = it.Icon;
            return (
              <button
                key={it.id}
                type="button"
                role="menuitem"
                ref={function (el) {
                  itemRefs.current[idx] = el;
                }}
                tabIndex={-1}
                onClick={function () {
                  runAndClose(idx);
                }}
                onMouseEnter={function () {
                  setFocusedIdx(idx);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  border: "none",
                  background: focusedIdx === idx ? DS.hoverBg : "transparent",
                  color: DS.text,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  textAlign: "left",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={function () {
                  setFocusedIdx(idx);
                }}
              >
                <span style={{ display: "flex", color: DS.primary, flexShrink: 0 }}>
                  <Icon size={18} strokeWidth={2} aria-hidden />
                </span>
                <span>{it.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
