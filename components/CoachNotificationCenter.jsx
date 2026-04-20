import React from "react";
import { createPortal } from "react-dom";
import { Bell, Check, MessageSquare, Target, Trophy, Zap } from "lucide-react";

const LS_READ = "it_coach_notif_read_v1";

const C = {
  card: "#12121a",
  brd: "#1e1e2e",
  t: "#ffffff",
  t2: "#71717a",
  blue: "#3b82f6",
  green: "#22c55e",
  yel: "#eab308",
  red: "#ef4444",
};

/** @typedef {{ key: string, alumnoId?: string, name: string, badge: string, desc: string, severity: number }} CoachAlertRow */

function loadReadIds() {
  try {
    var raw = localStorage.getItem(LS_READ);
    if (!raw) return [];
    var p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch (e) {
    return [];
  }
}

function saveReadIds(ids) {
  try {
    localStorage.setItem(LS_READ, JSON.stringify(ids));
  } catch (e) {}
}

function formatRelative(atMs, es) {
  var sec = Math.max(0, Math.floor((Date.now() - atMs) / 1000));
  if (sec < 60) return es ? "Ahora" : "Just now";
  var m = Math.floor(sec / 60);
  if (m < 60) return es ? "Hace " + m + " min" : m + "m ago";
  var h = Math.floor(m / 60);
  if (h < 24) return es ? "Hace " + h + " h" : h + "h ago";
  var d = Math.floor(h / 24);
  if (d === 1) return es ? "Ayer" : "Yesterday";
  return es ? "Hace " + d + " días" : d + "d ago";
}

/**
 * Notificaciones demo (MVP). Se mezclan con alertas reales del dashboard.
 * `action` describe el destino al hacer click (para cablear datos reales después).
 */
function buildMockNotifications(alumnos, es) {
  var a0 = (alumnos && alumnos[0]) || null;
  var a1 = (alumnos && alumnos[1]) || null;
  var n0 = a0 ? (a0.nombre || a0.email || "Alumno").trim() : es ? "María G." : "Alex R.";
  var n1 = a1 ? (a1.nombre || a1.email || "Alumno").trim() : es ? "Lucas P." : "Jordan K.";
  var id0 = a0 && a0.id != null ? String(a0.id) : null;
  var id1 = a1 && a1.id != null ? String(a1.id) : null;
  var now = Date.now();
  return [
    {
      id: "mock-msg-1",
      category: "mensaje",
      important: true,
      alumnoName: n0,
      alumnoId: id0,
      preview: es ? "Te envió un mensaje sobre la próxima semana." : "Sent you a message about next week.",
      atMs: now - 4 * 60 * 1000,
      hintChat: true,
      action: id0 ? { kind: "alumno", alumnoId: id0 } : { kind: "tab", tab: "alumnos" },
    },
    {
      id: "mock-msg-2",
      category: "mensaje",
      important: true,
      alumnoName: n1,
      alumnoId: id1,
      preview: es ? "Avisó molestia en rodilla post sentadilla." : "Reported knee discomfort after squats.",
      atMs: now - 52 * 60 * 1000,
      hintChat: true,
      action: id1 ? { kind: "alumno", alumnoId: id1 } : { kind: "tab", tab: "alumnos" },
    },
    {
      id: "mock-adh-1",
      category: "adherencia",
      important: true,
      alumnoName: n0,
      alumnoId: id0,
      preview: es ? "Lleva 5 días sin registrar entreno." : "No logged workout for 5 days.",
      atMs: now - 3 * 60 * 60 * 1000,
      action: id0 ? { kind: "alumno", alumnoId: id0 } : { kind: "tab", tab: "alumnos" },
    },
    {
      id: "mock-seg-1",
      category: "seguimiento",
      important: true,
      alumnoName: n1,
      alumnoId: id1,
      preview: es ? "Volumen semanal muy por debajo del plan." : "Weekly volume well below plan.",
      atMs: now - 26 * 60 * 60 * 1000,
      action: id1 ? { kind: "alumno", alumnoId: id1 } : { kind: "tab", tab: "alumnos" },
    },
    {
      id: "mock-log-1",
      category: "logro",
      important: false,
      alumnoName: n0,
      alumnoId: id0,
      preview: es ? "Nuevo PR en press banca — 82,5 kg." : "New bench PR — 82.5 kg.",
      atMs: now - 18 * 60 * 60 * 1000,
      action: id0 ? { kind: "alumno", alumnoId: id0 } : { kind: "tab", tab: "progress" },
    },
  ];
}

function mapAlertsToNotifications(alertRows, es) {
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
      atMs: Date.now() - (3 - (a.severity != null ? a.severity : 2)) * 45 * 60 * 1000,
      action: a.alumnoId != null ? { kind: "alumno", alumnoId: String(a.alumnoId) } : { kind: "tab", tab: "alumnos" },
    };
  });
}

function categoryMeta(cat, es) {
  switch (cat) {
    case "mensaje":
      return {
        label: es ? "Mensaje" : "Message",
        Icon: MessageSquare,
        color: C.blue,
      };
    case "adherencia":
      return {
        label: es ? "Adherencia" : "Adherence",
        Icon: Target,
        color: C.yel,
      };
    case "seguimiento":
      return {
        label: es ? "Seguimiento" : "Follow-up",
        Icon: Zap,
        color: C.red,
      };
    case "logro":
      return {
        label: es ? "Logro" : "Win",
        Icon: Trophy,
        color: C.green,
      };
    default:
      return { label: cat, Icon: Bell, color: C.t2 };
  }
}

/**
 * Campanita + panel de notificaciones (MVP: mezcla alertas reales del coach + mocks locales).
 */
export default function CoachNotificationCenter({
  es = true,
  /** Misma forma que devuelve buildCoachAlerts en CoachDashboard */
  alertRows = [],
  alumnos = [],
  onRevisarAlumno,
  onIrAlumnos,
  onIrProgreso,
  /** Opcional: abrir chat con un alumno (p. ej. mensajes entrantes). */
  onAbrirChatAlumno,
  /** Coach mobile: panel anclado a viewport para que no se corte a la izquierda. */
  useFixedMobilePanel = false,
}) {
  var [open, setOpen] = React.useState(false);
  var [filter, setFilter] = React.useState("all");
  var [readIds, setReadIds] = React.useState(loadReadIds);
  var wrapRef = React.useRef(null);
  var panelRef = React.useRef(null);

  var allItems = React.useMemo(
    function () {
      var real = mapAlertsToNotifications(alertRows, es);
      var mock = buildMockNotifications(alumnos, es);
      var seen = {};
      var out = [];
      real.forEach(function (x) {
        seen[x.id] = true;
        out.push(x);
      });
      mock.forEach(function (x) {
        if (seen[x.id]) return;
        out.push(x);
      });
      out.sort(function (a, b) {
        return b.atMs - a.atMs;
      });
      return out;
    },
    [alertRows, alumnos, es]
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
      saveReadIds(next);
      return next;
    });
  }

  function markAllRead() {
    setReadIds(function () {
      var next = allItems.map(function (x) {
        return x.id;
      });
      saveReadIds(next);
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
    boxShadow: "0 18px 48px rgba(0,0,0,0.55)",
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
    background: "#111827",
    border: "1px solid #1A2535",
    borderRadius: 14,
    zIndex: 10050,
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
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
        <div style={{ fontSize: 15, fontWeight: 800, color: C.t }}>{es ? "Notificaciones" : "Notifications"}</div>
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
            {es ? "Marcar leídas" : "Mark read"}
          </button>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 6, padding: "8px 10px 10px", borderBottom: "1px solid " + C.brd, flexShrink: 0 }}>
        {[
          { id: "all", label: es ? "Todas" : "All" },
          { id: "important", label: es ? "Importantes" : "Important" },
          { id: "unread", label: es ? "No leídas" : "Unread" },
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
                color: active ? "#fff" : C.t2,
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
            <div style={{ fontSize: 15, fontWeight: 700, color: C.t, marginBottom: 6 }}>{es ? "Sin notificaciones" : "No notifications"}</div>
            <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.45 }}>
              {es ? "Cuando haya alertas o mensajes relevantes, aparecerán acá." : "When there are relevant alerts or messages, they will show up here."}
            </div>
          </div>
        ) : (
          filtered.map(function (item) {
            var unread = readIds.indexOf(item.id) < 0;
            var meta = categoryMeta(item.category, es);
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
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.t2, textTransform: "uppercase" }}>{es ? "Leída" : "Read"}</span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 800, color: C.blue, textTransform: "uppercase" }}>{es ? "Nueva" : "New"}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.t, marginBottom: 2 }}>{item.alumnoName}</div>
                  <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.35, marginBottom: 4 }}>{item.preview}</div>
                  <div style={{ fontSize: 11, color: C.t2 }}>{formatRelative(item.atMs, es)}</div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div style={{ padding: "8px 12px", borderTop: "1px solid " + C.brd, fontSize: 11, color: C.t2, flexShrink: 0, lineHeight: 1.35 }}>
        {es
          ? "Las alertas de adherencia usan datos reales del equipo. Mensajes y otros eventos son demo hasta conectar backend."
          : "Adherence alerts use real team data. Messages and other events are demo until backend is wired."}
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
        aria-label={es ? "Notificaciones" : "Notifications"}
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
        <Bell size={17} color="#94a3b8" strokeWidth={2} />
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
              border: "2px solid #0d0d15",
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
          aria-label={es ? "Centro de notificaciones" : "Notification center"}
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
            aria-label={es ? "Centro de notificaciones" : "Notification center"}
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
