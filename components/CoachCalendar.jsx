import React from "react";
import { CalendarDays, ChevronDown, Search, Trash2, X } from "lucide-react";
import { irontrackMsg as M } from "../lib/irontrackMsg.js";

const LS_KEY = "it_calendar_assignments_v1";
const MONTH_NAMES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MONTH_NAMES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_NAMES_PT = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DOW_ES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const DOW_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOW_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateKey(year, month, day) {
  return year + "-" + pad2(month + 1) + "-" + pad2(day);
}

function todayKey() {
  var d = new Date();
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function uid() {
  try {
    if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch (e) {}
  return "cal-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function readAssignments() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeAssignments(next) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch (e) {}
}

function routineName(r) {
  return r?.nombre || r?.name || r?.datos?.name || "Rutina";
}

function normalizeText(v) {
  return String(v || "").trim().toLowerCase();
}

function monthNames(lang) {
  if (lang === "en") return MONTH_NAMES_EN;
  if (lang === "pt") return MONTH_NAMES_PT;
  return MONTH_NAMES_ES;
}

function dayNames(lang) {
  if (lang === "en") return DOW_EN;
  if (lang === "pt") return DOW_PT;
  return DOW_ES;
}

export default function CoachCalendar({ alumnos = [], rutinas = [], lang = "es", dark = true }) {
  var now = React.useMemo(function () { return new Date(); }, []);
  var year = now.getFullYear();
  var currentMonth = now.getMonth();
  var tKey = todayKey();
  var months = monthNames(lang);
  var dows = dayNames(lang);
  var P = {
    bg: "#0A0F1A",
    card: "#0D1424",
    card2: "#111827",
    border: "rgba(100, 116, 139, 0.22)",
    text: "#F8FAFC",
    muted: "#64748b",
    primary: "#2563EB",
    success: "#22C55E",
    danger: "#EF4444",
  };

  const [openMonths, setOpenMonths] = React.useState(function () {
    return { [currentMonth]: true };
  });
  const [assignments, setAssignments] = React.useState(readAssignments);
  const [selectedDate, setSelectedDate] = React.useState(null);
  const [step, setStep] = React.useState("alumno");
  const [selectedAlumno, setSelectedAlumno] = React.useState(null);
  const [selectedRutina, setSelectedRutina] = React.useState(null);
  const [alumnoQuery, setAlumnoQuery] = React.useState("");
  const [rutinaQuery, setRutinaQuery] = React.useState("");
  const [savedNotice, setSavedNotice] = React.useState(false);

  React.useEffect(function () {
    writeAssignments(assignments);
  }, [assignments]);

  var selectedAssignments = selectedDate ? assignments[selectedDate] || [] : [];
  var filteredAlumnos = (alumnos || []).filter(function (a) {
    var q = normalizeText(alumnoQuery);
    if (!q) return true;
    return normalizeText((a.nombre || "") + " " + (a.email || "")).includes(q);
  });
  var filteredRutinas = (rutinas || []).filter(function (r) {
    var q = normalizeText(rutinaQuery);
    if (!q) return true;
    return normalizeText(routineName(r)).includes(q);
  });

  function openDate(key) {
    setSelectedDate(key);
    setStep("alumno");
    setSelectedAlumno(null);
    setSelectedRutina(null);
    setAlumnoQuery("");
    setRutinaQuery("");
    setSavedNotice(false);
  }

  function closeModal() {
    setSelectedDate(null);
    setStep("alumno");
    setSelectedAlumno(null);
    setSelectedRutina(null);
    setSavedNotice(false);
  }

  function confirmAssignment() {
    if (!selectedDate || !selectedAlumno || !selectedRutina) return;
    var item = {
      id: uid(),
      alumno_id: selectedAlumno.id,
      alumno_nombre: selectedAlumno.nombre || selectedAlumno.email || "Alumno",
      rutina_id: selectedRutina.id,
      rutina_nombre: routineName(selectedRutina),
      created_at: new Date().toISOString(),
    };
    setAssignments(function (prev) {
      var list = Array.isArray(prev[selectedDate]) ? prev[selectedDate] : [];
      return Object.assign({}, prev, { [selectedDate]: list.concat(item) });
    });
    setSavedNotice(true);
    window.setTimeout(function () {
      closeModal();
    }, 450);
  }

  function deleteAssignment(itemId) {
    if (!window.confirm(M(lang, "Eliminar esta asignacion local?", "Delete this local assignment?", "Excluir esta atribuicao local?"))) return;
    setAssignments(function (prev) {
      var list = (prev[selectedDate] || []).filter(function (x) { return x.id !== itemId; });
      var next = Object.assign({}, prev);
      if (list.length) next[selectedDate] = list;
      else delete next[selectedDate];
      return next;
    });
  }

  function renderMonth(month) {
    var first = new Date(year, month, 1);
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var leading = (first.getDay() + 6) % 7;
    var cells = [];
    for (var i = 0; i < leading; i++) cells.push(null);
    for (var d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
        {dows.map(function (dow) {
          return <div key={month + "-dow-" + dow} style={{ color: P.muted, fontSize: 11, fontWeight: 800, textAlign: "center" }}>{dow}</div>;
        })}
        {cells.map(function (day, idx) {
          if (!day) return <div key={month + "-blank-" + idx} style={{ minHeight: 46 }} />;
          var key = dateKey(year, month, day);
          var count = (assignments[key] || []).length;
          var isToday = key === tKey;
          var isSelected = key === selectedDate;
          return (
            <button
              key={key}
              type="button"
              className="hov"
              onClick={function () { openDate(key); }}
              style={{
                minHeight: 46,
                border: isSelected ? "1px solid " + P.primary : isToday ? "1px solid " + P.success : "1px solid " + P.border,
                borderRadius: 14,
                background: isSelected ? "rgba(37,99,235,0.18)" : isToday ? "rgba(34,197,94,0.12)" : P.card2,
                color: isToday ? P.success : P.text,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                boxSizing: "border-box",
              }}
            >
              <span>{day}</span>
              {count > 0 ? <span style={{ width: 7, height: 7, borderRadius: 99, background: P.primary }} /> : <span style={{ width: 7, height: 7 }} />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 1120, margin: "0 auto", color: P.text }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: P.primary, fontSize: 13, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase" }}>
            <CalendarDays size={18} strokeWidth={2.2} />
            {M(lang, "Calendario", "Calendar", "Calendario")}
          </div>
          <h1 style={{ margin: "6px 0 0", fontSize: 28, lineHeight: 1.05, letterSpacing: 0, color: P.text }}>
            {M(lang, "Asignaciones por fecha", "Assignments by date", "Atribuicoes por data")}
          </h1>
        </div>
        <div style={{ background: P.card, border: "1px solid " + P.border, borderRadius: 18, padding: "10px 14px", color: P.muted, fontSize: 13, fontWeight: 700 }}>
          {Object.values(assignments).reduce(function (acc, list) { return acc + (Array.isArray(list) ? list.length : 0); }, 0)} {M(lang, "asignaciones", "assignments", "atribuicoes")}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {months.map(function (name, month) {
          var open = !!openMonths[month];
          return (
            <section key={name} style={{ background: P.card, border: "1px solid " + P.border, borderRadius: 24, overflow: "hidden" }}>
              <button
                type="button"
                onClick={function () {
                  setOpenMonths(function (prev) {
                    return Object.assign({}, prev, { [month]: !prev[month] });
                  });
                }}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  color: P.text,
                  padding: "18px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 900 }}>{name} {year}</span>
                <ChevronDown size={20} color={P.muted} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .18s ease" }} />
              </button>
              {open ? <div style={{ padding: "0 14px 16px" }}>{renderMonth(month)}</div> : null}
            </section>
          );
        })}
      </div>

      {selectedDate ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(2,6,23,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 560, maxHeight: "min(760px, calc(100vh - 32px))", overflowY: "auto", background: P.bg, border: "1px solid " + P.border, borderRadius: 24, boxShadow: "0 24px 80px rgba(0,0,0,.45)" }}>
            <div style={{ position: "sticky", top: 0, background: P.bg, zIndex: 2, padding: 18, borderBottom: "1px solid " + P.border, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ color: P.muted, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>{selectedDate}</div>
                <div style={{ color: P.text, fontSize: 20, fontWeight: 900 }}>{M(lang, "Asignar rutina", "Assign routine", "Atribuir rotina")}</div>
              </div>
              <button type="button" className="hov" onClick={closeModal} style={{ width: 40, height: 40, borderRadius: 14, border: "none", background: P.card, color: P.muted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 18 }}>
              {selectedAssignments.length > 0 ? (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ color: P.muted, fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{M(lang, "Ya asignado", "Already assigned", "Ja atribuido")}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedAssignments.map(function (item) {
                      return (
                        <div key={item.id} style={{ background: P.card, border: "1px solid " + P.border, borderRadius: 16, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: P.text, fontSize: 15, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.alumno_nombre}</div>
                            <div style={{ color: P.muted, fontSize: 13, fontWeight: 700, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.rutina_nombre}</div>
                          </div>
                          <button type="button" className="hov" onClick={function () { deleteAssignment(item.id); }} style={{ width: 38, height: 38, borderRadius: 12, border: "none", background: "rgba(239,68,68,0.12)", color: P.danger, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} aria-label={M(lang, "Eliminar", "Delete", "Excluir")}>
                            <Trash2 size={17} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {savedNotice ? (
                <div style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 16, padding: 14, color: P.success, fontWeight: 900, marginBottom: 16 }}>
                  {M(lang, "Rutina asignada", "Routine assigned", "Rotina atribuida")}
                </div>
              ) : null}

              {step === "alumno" ? (
                <>
                  <div style={{ color: P.text, fontSize: 18, fontWeight: 900, marginBottom: 10 }}>{M(lang, "Elegir alumno", "Choose athlete", "Escolher aluno")}</div>
                  <div style={{ background: P.card, border: "1px solid " + P.border, borderRadius: 16, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <Search size={18} color={P.muted} />
                    <input value={alumnoQuery} onChange={function (e) { setAlumnoQuery(e.target.value); }} placeholder={M(lang, "Buscar alumno", "Search athlete", "Buscar aluno")} style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: P.text, fontSize: 15, fontFamily: "inherit" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filteredAlumnos.map(function (a) {
                      return (
                        <button key={a.id} type="button" className="hov" onClick={function () { setSelectedAlumno(a); setStep("rutina"); }} style={{ textAlign: "left", background: P.card, color: P.text, border: "1px solid " + P.border, borderRadius: 16, padding: 14, cursor: "pointer", fontFamily: "inherit" }}>
                          <div style={{ fontSize: 16, fontWeight: 900 }}>{a.nombre || a.email || "Alumno"}</div>
                          {a.email ? <div style={{ color: P.muted, fontSize: 13, fontWeight: 700, marginTop: 2 }}>{a.email}</div> : null}
                        </button>
                      );
                    })}
                    {filteredAlumnos.length === 0 ? <div style={{ color: P.muted, textAlign: "center", padding: 24 }}>{M(lang, "No hay alumnos para mostrar", "No athletes to show", "Nao ha alunos")}</div> : null}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: P.muted, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>{M(lang, "Alumno", "Athlete", "Aluno")}</div>
                  <div style={{ color: P.text, fontSize: 18, fontWeight: 900, marginBottom: 12 }}>{selectedAlumno?.nombre || selectedAlumno?.email || "Alumno"}</div>
                  <div style={{ background: P.card, border: "1px solid " + P.border, borderRadius: 16, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <Search size={18} color={P.muted} />
                    <input value={rutinaQuery} onChange={function (e) { setRutinaQuery(e.target.value); }} placeholder={M(lang, "Buscar rutina", "Search routine", "Buscar rotina")} style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: P.text, fontSize: 15, fontFamily: "inherit" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {filteredRutinas.map(function (r) {
                      var active = selectedRutina?.id === r.id;
                      return (
                        <button key={r.id} type="button" className="hov" onClick={function () { setSelectedRutina(r); }} style={{ textAlign: "left", background: active ? "rgba(37,99,235,0.18)" : P.card, color: P.text, border: active ? "1px solid " + P.primary : "1px solid " + P.border, borderRadius: 16, padding: 14, cursor: "pointer", fontFamily: "inherit" }}>
                          <div style={{ fontSize: 16, fontWeight: 900 }}>{routineName(r)}</div>
                          <div style={{ color: P.muted, fontSize: 13, fontWeight: 700, marginTop: 2 }}>{((r.datos?.days || r.days || []).length)} {M(lang, "dias", "days", "dias")}</div>
                        </button>
                      );
                    })}
                    {filteredRutinas.length === 0 ? <div style={{ color: P.muted, textAlign: "center", padding: 24 }}>{M(lang, "No hay rutinas disponibles", "No routines available", "Nao ha rotinas")}</div> : null}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" className="hov" onClick={function () { setStep("alumno"); setSelectedRutina(null); }} style={{ flex: "1 1 120px", padding: "13px 14px", borderRadius: 14, border: "none", background: P.card, color: P.muted, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>{M(lang, "Volver", "Back", "Voltar")}</button>
                    <button type="button" className="hov" onClick={closeModal} style={{ flex: "1 1 120px", padding: "13px 14px", borderRadius: 14, border: "none", background: "rgba(100,116,139,0.16)", color: P.muted, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>{M(lang, "Cancelar", "Cancel", "Cancelar")}</button>
                    <button type="button" className="hov" disabled={!selectedRutina} onClick={confirmAssignment} style={{ flex: "2 1 180px", padding: "13px 14px", borderRadius: 14, border: "none", background: selectedRutina ? P.primary : "rgba(100,116,139,0.18)", color: "#fff", fontWeight: 900, cursor: selectedRutina ? "pointer" : "not-allowed", fontFamily: "inherit" }}>{M(lang, "Asignar rutina", "Assign routine", "Atribuir rotina")}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
