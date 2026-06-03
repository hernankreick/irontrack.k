import React from 'react';
import { MessageCircle } from 'lucide-react';
import { formatChatTime } from '../../lib/timeFormat.js';
import { irontrackMsg as M } from '../../lib/irontrackMsg.js';

function initials(name) {
  var parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  var a = parts[0] ? parts[0][0] : "?";
  var b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function buildConversationRows(alumnos, mensajes) {
  var alumnosById = {};
  (alumnos || []).forEach(function (a) {
    if (a && a.id != null) alumnosById[String(a.id)] = a;
  });

  var grouped = {};
  (mensajes || []).forEach(function (m) {
    if (!m || m.alumno_id == null) return;
    var id = String(m.alumno_id);
    var alumno = alumnosById[id];
    if (!alumno) return;
    if (!grouped[id]) {
      grouped[id] = {
        alumnoId: id,
        alumnoNombre: alumno.nombre || alumno.email || "Alumno",
        lastMessage: m,
        unreadCount: 0,
      };
    }
    var currentLast = grouped[id].lastMessage;
    var mTime = new Date(m.created_at || 0).getTime() || 0;
    var lastTime = new Date(currentLast && currentLast.created_at ? currentLast.created_at : 0).getTime() || 0;
    if (mTime > lastTime) grouped[id].lastMessage = m;
    if (!m.de_entrenador && !m.leido) grouped[id].unreadCount += 1;
  });

  return Object.keys(grouped)
    .map(function (id) {
      return grouped[id];
    })
    .sort(function (a, b) {
      var ta = new Date(a.lastMessage && a.lastMessage.created_at ? a.lastMessage.created_at : 0).getTime() || 0;
      var tb = new Date(b.lastMessage && b.lastMessage.created_at ? b.lastMessage.created_at : 0).getTime() || 0;
      return tb - ta;
    });
}

export default function CoachMessagesMain({
  alumnos,
  sb,
  darkMode,
  lang,
  onMensajesLeidos,
  onOpenConversation,
}) {
  var C = React.useMemo(function () {
    return {
      bg: darkMode ? "#0B1220" : "#F6F8FB",
      surface: darkMode ? "#111827" : "#FFFFFF",
      surface2: darkMode ? "#162234" : "#F8FAFC",
      border: darkMode ? "#1E2D40" : "#E2E8F0",
      text: darkMode ? "#F8FAFC" : "#0F172A",
      muted: darkMode ? "#8B9AB2" : "#64748B",
      softBlue: darkMode ? "rgba(37,99,235,.16)" : "rgba(37,99,235,.10)",
    };
  }, [darkMode]);

  var [rows, setRows] = React.useState([]);
  var [loading, setLoading] = React.useState(true);

  var load = React.useCallback(async function () {
    var ids = (alumnos || []).map(function (a) { return a && a.id; }).filter(Boolean);
    if (!ids.length) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      var mensajes = [];
      if (sb && typeof sb.getMensajesConversaciones === "function") {
        mensajes = await sb.getMensajesConversaciones(ids);
      }
      setRows(buildConversationRows(alumnos, mensajes || []));
    } catch (e) {
      console.error("[CoachMessagesMain] load conversations", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [alumnos, sb]);

  React.useEffect(function () {
    load();
    var t = setInterval(load, 15000);
    return function () {
      clearInterval(t);
    };
  }, [load]);

  function openRow(row) {
    setRows(function (prev) {
      return (prev || []).map(function (r) {
        return r.alumnoId === row.alumnoId ? Object.assign({}, r, { unreadCount: 0 }) : r;
      });
    });
    if (typeof onMensajesLeidos === "function") {
      onMensajesLeidos(row.alumnoId);
    }
    if (typeof onOpenConversation === "function") {
      onOpenConversation(row.alumnoId, row.alumnoNombre);
    }
  }

  return (
    <div style={{ minHeight: "100%", background: C.bg, color: C.text, overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 920, margin: "0 auto", padding: "20px 16px 96px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 26, lineHeight: 1, fontWeight: 900, letterSpacing: 0 }}>
              {M(lang, "Mensajes", "Messages", "Mensagens")}
            </div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>
              {M(lang, "Conversaciones con tus alumnos", "Conversations with your athletes", "Conversas com seus alunos")}
            </div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: C.softBlue, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <MessageCircle size={20} color="#3B82F6" strokeWidth={2} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loading && [1, 2, 3].map(function (i) {
            return <div key={i} className="sk" style={{ height: 76, borderRadius: 14 }} />;
          })}

          {!loading && rows.length === 0 && (
            <div style={{ border: "1px solid " + C.border, background: C.surface, borderRadius: 14, padding: "34px 18px", textAlign: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: C.softBlue, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <MessageCircle size={21} color="#3B82F6" strokeWidth={2} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
                Todavía no tenés mensajes
              </div>
            </div>
          )}

          {!loading && rows.map(function (row) {
            var last = row.lastMessage || {};
            var unread = row.unreadCount > 0;
            return (
              <button
                key={row.alumnoId}
                type="button"
                onClick={function () { openRow(row); }}
                style={{
                  width: "100%",
                  border: "1px solid " + (unread ? "rgba(59,130,246,.45)" : C.border),
                  background: unread ? (darkMode ? "rgba(37,99,235,.10)" : "#EFF6FF") : C.surface,
                  borderRadius: 14,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                  cursor: "pointer",
                  boxShadow: darkMode ? "none" : "0 1px 2px rgba(15,23,42,.04)",
                }}
              >
                <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg,#1d4ed8,#2563EB)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, flexShrink: 0 }}>
                  {initials(row.alumnoNombre)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div style={{ color: C.text, fontSize: 15, fontWeight: unread ? 900 : 800, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {row.alumnoNombre}
                    </div>
                    <div style={{ color: unread ? "#3B82F6" : C.muted, fontSize: 12, fontWeight: 700, marginLeft: "auto", flexShrink: 0 }}>
                      {formatChatTime(last.created_at, lang === "en" ? "en-US" : "es-AR")}
                    </div>
                  </div>
                  <div style={{ color: unread ? C.text : C.muted, fontSize: 13, marginTop: 5, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {last.texto || ""}
                  </div>
                </div>
                {unread && (
                  <div style={{ minWidth: 22, height: 22, borderRadius: 11, background: "#22C55E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
                    {row.unreadCount > 9 ? "9+" : row.unreadCount}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
