import React from "react";
import { createPortal } from "react-dom";
import { Bell, Check, MessageSquare, Target, Trophy, Zap } from "lucide-react";
import { irontrackMsg as M } from "../lib/irontrackMsg.js";
import { coachThemePalette } from "./coachThemePalette.js";

const LS_READ_LEGACY = "it_coach_notif_read_v1";
const LS_READ_PREFIX = "irontrack_coach_notif_read_v2";

/** @typedef {{ key: string, alumnoId?: string, name: string, badge: string, desc: string, severity: number }} CoachAlertRow */

function buildReadStorageKey() {
  try {
    if (typeof localStorage === "undefined") return LS_READ_PREFIX + "_anon";
    var raw = localStorage.getItem("it_session");
    if (!raw) return LS_READ_PREFIX + "_anon";
    var sess = JSON.parse(raw);
    if (!sess || typeof sess !== "object") return LS_READ_PREFIX + "_anon";
    if (sess.role === "entrenador") {
      var name = typeof sess.name === "string" ? sess.name.trim().toLowerCase() : "";
      if (!name) return LS_READ_PREFIX + "_coach";
      return LS_READ_PREFIX + "_coach_" + encodeURIComponent(name);
    }
    if (sess.role === "alumno" && sess.alumnoId != null) {
      return LS_READ_PREFIX + "_student_" + encodeURIComponent(String(sess.alumnoId));
    }
    return LS_READ_PREFIX + "_anon";
  } catch (e) {
    return LS_READ_PREFIX + "_anon";
  }
}

function loadReadIds(storageKey) {
  try {
    var raw = localStorage.getItem(storageKey);
    if (!raw) {
      // Backward-compat: migrate values from legacy key once.
      var legacyRaw = localStorage.getItem(LS_READ_LEGACY);
      if (!legacyRaw) return [];
      var legacyParsed = JSON.parse(legacyRaw);
      if (!Array.isArray(legacyParsed)) return [];
      localStorage.setItem(storageKey, JSON.stringify(legacyParsed));
      return legacyParsed;
    }
    var p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch (e) {
    return [];
  }
}

function saveReadIds(storageKey, ids) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch (e) {}
}

function formatRelative(atMs, lang) {
  var sec = Math.max(0, Math.floor((Date.now() - atMs) / 1000));
  if (sec < 60) return M(lang, "Ahora", "Just now", "Agora");
  var m = Math.floor(sec / 60);
  if (m < 60) return M(lang, "Hace " + m + " min", m + "m ago", "Há " + m + " min");
  var h = Math.floor(m / 60);
  if (h < 24) return M(lang, "Hace " + h + " h", h + "h ago", "Há " + h + " h");
  var d = Math.floor(h / 24);
  if (d === 1) return M(lang, "Ayer", "Yesterday", "Ontem");
  return M(lang, "Hace " + d + " días", d + "d ago", "Há " + d + " dias");
}

function mapAlertsToNotifications(alertRows) {
  if (!Array.isArray(alertRows)) return [];
  return alertRows.map(function (a) {
    var important = a.severity <= 1;
    var cat = a.severity === 2 ? "seguimiento" : "adherencia";
    return {
      id: "real-" + a.key,
      category: cat,
      important: important,
      alumnoName: a.name,
      alumnoId: a.alumnoId != null ? String(a.alumnoId) : null,
      preview: a.desc,
      atMs: a.atMs != null ? a.atMs : null,
      action: a.alumnoId != null ? { kind: "alumno", alumnoId: String(a.alumnoId) } : { kind: "tab", tab: "alumnos" },
    };
  });
}

function categoryMeta(cat, lang, P) {
  var pal = P || coachThemePalette(true);
  switch (cat) {
    case "mensaje":
      return {
        label: M(lang, "Mensaje", "Message", "Mensagem"),
        Icon: MessageSquare,
        color: pal.blue,
      };
    case "adherencia":
      return {
        label: M(lang, "Adherencia", "Adherence", "Aderência"),
        Icon: Target,
        color: pal.yel,
      };
    case "seguimiento":
      return {
        label: M(lang, "Seguimiento", "Follow-up", "Acompanhamento"),
        Icon: Zap,
        color: pal.red,
      };
    case "logro":
      return {
        label: M(lang, "Logro", "Win", "Conquista"),
        Icon: Trophy,
        color: pal.green,
      };
    default:
      return { label: cat, Icon: Bell, color: pal.t2 };
  }
}

/** Campanita + panel de notificaciones reales del coach. */
export default function CoachNotificationCenter({
  lang = "es",
  /** Misma forma que devuelve buildCoachAlerts en CoachDashboard */
  alertRows = [],
  onRevisarAlumno,
  onIrAlumnos,
  onIrProgreso,
  /** Opcional: abrir chat con un alumno (p. ej. mensajes entrantes). */
  onAbrirChatAlumno,
  /** Coach mobile: panel anclado a viewport para que no se corte a la izquierda. */
  useFixedMobilePanel = false,
  darkMode = true,
}) {
  var C = React.useMemo(
    function () {
      return coachThemePalette(darkMode);
    },
    [darkMode]
  );

  var [open, setOpen] = React.useState(false);
  var [filter, setFilter] = React.useState("all");
  var storageKey = React.useMemo(buildReadStorageKey, []);
  var [readIds, setReadIds] = React.useState(function () {
    return loadReadIds(storageKey);
  });
  var wrapRef = React.useRef(null);
  var panelRef = React.useRef(null);

  React.useEffect(
    function () {
      setReadIds(loadReadIds(storageKey));
    },
    [storageKey]
  );

  var allItems = React.useMemo(
    function () {
      var out = mapAlertsToNotifications(alertRows);
      out.sort(function (a, b) {
        if (a.atMs == null && b.atMs == null) return 0;
        if (a.atMs == null) return 1;
        if (b.atMs == null) return -1;
        return b.atMs - a.atMs;
      });
      return out;
    },
    [alertRows]
  );

  var unreadCount = React.useMemo(
    function () {
      return allItems.filter(function (x) {
        return readIds.indexOf(x.id) < 0;
      }).length;
    },
    [allItems, readIds]
  );

  var filtered = React.useMemo(
    function () {
      return allItems.filter(function (x) {
        var unread = readIds.indexOf(x.id) < 0;
        if (filter === "unread") return unread;
        if (filter === "important") return x.important;
        return true;
      });
    },
    [allItems, filter, readIds]
  );

  React.useEffect(
    function () {
      if (!open) return undefined;
      function onDoc(e) {
        var t = e.target;
        var inWrap = wrapRef.current && wrapRef.current.contains(t);
        var inPanel = panelRef.current && panelRef.current.contains(t);
        if (!inWrap && !inPanel) setOpen(false);
      }
      function onKey(e) {
        if (e.key === "Escape") setOpen(false);
      }
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
      return function () {
        document.removeEventListener("mousedown", onDoc);
        document.removeEventListener("keydown", onKey);
      };
    },
    [open]
  );

  function markRead(id) {
    setReadIds(function (prev) {
      if (prev.indexOf(id) >= 0) return prev;
      var next = prev.concat([id]);
      saveReadIds(storageKey, next);
      return next;
    });
  }

  function markAllRead() {
    setReadIds(function () {
      var next = allItems.map(function (x) {
        return x.id;
      });
      saveReadIds(storageKey, next);
      return next;
    });
  }

  function runAction(item) {
    markRead(item.id);
    setOpen(false);
    if (item.hintChat && typeof onAbrirChatAlumno === "function" && item.alumnoId) {
      onAbrirChatAlumno(item.alumnoId);
      return;
    }
    var act = item.action;
    if (!act) return;
    if (act.kind === "alumno" && act.alumnoId && typeof onRevisarAlumno === "function") {
      onRevisarAlumno(act.alumnoId);
      return;
    }
    if (act.kind === "tab") {
      if (act.tab === "alumnos" && typeof onIrAlumnos === "function") onIrAlumnos();
      else if (act.tab === "progress" && typeof onIrProgreso === "function") onIrProgreso();
    }
  }

  var absolutePanelStyle = {
    position: "absolute",
    right: 0,
    top: "calc(100% + 8px)",
    width: "min(100vw - 24px, 380px)",
    maxHeight: "min(70vh, 520px)",
    background: C.card,
    border: "1px solid " + C.brd,
    borderRadius: 12,
    boxShadow: darkMode ? "0 18px 48px rgba(0,0,0,0.55)" : "0 12px 40px rgba(15,23,42,0.12)",
    zIndex: 300,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  /** Viewport real: `fixed` dentro de un ancestro con transform recorta el panel; el portal evita eso. */
  var fixedMobilePanelStyle = {
    position: "fixed",
    top: "calc(8px + env(safe-area-inset-top, 0px) + 120px)",
    left: "max(12px, env(safe-area-inset-left, 0px))",
    right: "max(12px, env(safe-area-inset-right, 0px))",
    width: "auto",
    maxWidth: "min(100vw - 24px, 480px)",
    marginLeft: "auto",
    marginRight: "auto",
    boxSizing: "border-box",
    maxHeight: "70vh",
    background: C.card,
    border: "1px solid " + C.brd,
    borderRadius: 14,
    zIndex: 10050,
    boxShadow: darkMode ? "0 8px 32px rgba(0,0,0,0.6)" : "0 8px 28px rgba(15,23,42,0.1)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    WebkitOverflowScrolling: "touch",
  };

  var panelInner = (
    <>
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid " + C.brd,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, color: C.t }}>{M(lang, "Notificaciones", "Notifications", "Notificações")}</div>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={markAllRead}
            style={{
              background: "transparent",
              border: "none",
              color: C.blue,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Check size={14} strokeWidth={2.5} />
            {M(lang, "Marcar leídas", "Mark read", "Marcar como lidas")}
          </button>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 6, padding: "8px 10px 10px", borderBottom: "1px solid " + C.brd, flexShrink: 0 }}>
        {[
          { id: "all", label: M(lang, "Todas", "All", "Todas") },
          { id: "important", label: M(lang, "Importantes", "Important", "Importantes") },
          { id: "unread", label: M(lang, "No leídas", "Unread", "Não lidas") },
        ].map(function (t) {
          var active = filter === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={function () {
                setFilter(t.id);
              }}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid " + (active ? C.blue : C.brd),
                background: active ? "rgba(59,130,246,0.18)" : "transparent",
                color: active ? C.blue : C.t2,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: "36px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.35 }}>📭</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.t, marginBottom: 6 }}>{M(lang, "No hay notificaciones por ahora", "No notifications right now", "Sem notificações por enquanto")}</div>
            <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.45 }}>
              {M(lang, "Todo al día.", "Everything is up to date.", "Tudo em dia.")}
            </div>
          </div>
        ) : (
          filtered.map(function (item) {
            var unread = readIds.indexOf(item.id) < 0;
            var meta = categoryMeta(item.category, lang, C);
            var Icon = meta.Icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={function () {
                  runAction(item);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  gap: 10,
                  padding: "12px 14px",
                  border: "none",
                  borderBottom: "1px solid " + C.brd,
                  background: unread ? "rgba(59,130,246,0.06)" : "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid " + C.brd,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} color={meta.color} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: 0.3 }}>{meta.label}</span>
                    {!unread ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.t2, textTransform: "uppercase" }}>{M(lang, "Leída", "Read", "Lida")}</span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 800, color: C.blue, textTransform: "uppercase" }}>{M(lang, "Nueva", "New", "Nova")}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.t, marginBottom: 2 }}>{item.alumnoName}</div>
                  <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.35, marginBottom: 4 }}>{item.preview}</div>
                  {item.atMs != null ? <div style={{ fontSize: 11, color: C.t2 }}>{formatRelative(item.atMs, lang)}</div> : null}
                </div>
              </button>
            );
          })
        )}
      </div>

    </>
  );

  return (
    <>
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={M(lang, "Notificaciones", "Notifications", "Notificações")}
        onClick={function () {
          setOpen(function (v) {
            return !v;
          });
        }}
        style={{
          width: 36,
          height: 36,
          background: C.card,
          border: "1px solid " + C.brd,
          borderRadius: 7,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          position: "relative",
        }}
      >
        <Bell size={17} color={C.t2} strokeWidth={2} />
        {unreadCount > 0 ? (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 9,
              background: C.red,
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid " + C.bg,
              boxSizing: "border-box",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open && !useFixedMobilePanel ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={M(lang, "Centro de notificaciones", "Notification center", "Central de notificações")}
          style={absolutePanelStyle}
        >
          {panelInner}
        </div>
      ) : null}
    </div>
    {open && useFixedMobilePanel && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={M(lang, "Centro de notificaciones", "Notification center", "Central de notificações")}
            style={fixedMobilePanelStyle}
          >
            {panelInner}
          </div>,
          document.body
        )
      : null}
    </>
  );
}
