import React from 'react';
import { Ic } from './Ic.jsx';
import { ExerciseCard } from './ExerciseCard.jsx';
import { emptyDays } from '../lib/routineTemplates.js';
import { fmtP } from '../lib/timeFormat.js';

const uid = () => Math.random().toString(36).slice(2, 9);

export function RutinaView(props) {
  const {
    setTab,
    border,
    textMuted,
    bgCard,
    textMain,
    darkMode,
    bgSub,
    es,
    setFiltroRut,
    btn,
    card,
    setNewR,
    routines,
    setRoutines,
    allEx,
    PATS,
    setEditEx,
    toast2,
    setAddExModal,
    setAddExSearch,
    setAddExPat,
    setAddExSelectedIds,
    setDupDayModal,
    alumnos,
    sb,
    setAssignRoutineId,
  } = props;

  return (
    <div>
      <button className="hov" onClick={() => setTab("scanner")}
        style={{ width: "100%", marginBottom: 12, padding: "8px 16px",
          background: "transparent", border: "1px solid " + border,
          borderRadius: 12, color: textMuted, fontSize: 15, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit", display: "flex",
          alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Ic name="camera" size={16} /> {es ? "Escanear rutina existente" : "Scan existing routine"}
      </button>
      <div style={{ overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, width: "max-content" }}>
          {["todas", "app", "scan"].map(f => (
            <button key={f} className="hov" onClick={() => setFiltroRut && setFiltroRut(f)} style={{ padding: "8px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid", fontFamily: "Barlow Condensed,sans-serif", background: bgCard, borderColor: "#2D4057", color: textMuted, display: "inline-flex", alignItems: "center", gap: 6 }}>
              {f === "todas" ? "TODAS" : f === "app" ? (<><Ic name="edit-2" size={14} color={textMuted} /> APP</>) : (<><Ic name="camera" size={14} color={textMuted} /> {es ? "ESCANEADAS" : "SCANNED"}</>)}
            </button>
          ))}
        </div>
      </div>
      <button className="hov" style={{ ...btn("#2563EB"), width: "100%", marginBottom: 12, padding: "8px", fontSize: 18 }} onClick={() => setNewR({ templateId: "blank", name: "", numDays: 3, days: emptyDays(3, es), note: "", alumno: "", showAdvanced: false })}>
        {es ? "+ NUEVA RUTINA" : "+ NEW ROUTINE"}
      </button>
      {routines.map(r => {
        const daysJSX = !r.collapsed ? r.days.map((d, di) => {
          const moveEx = (bloque, fromIdx, toIdx) => {
            setRoutines(p => p.map(rr => rr.id === r.id ? { ...rr, days: rr.days.map((dd, ddi) => {
              if (ddi !== di) return dd;
              const arr = [...(dd[bloque] || [])];
              const [item] = arr.splice(fromIdx, 1);
              arr.splice(toIdx, 0, item);
              return { ...dd, [bloque]: arr };
            }) } : rr));
          };
          const renderExList = (exList, bloque) => exList.map((ex, ei) => {
            const info = allEx.find(e => e.id === ex.id);
            const pat = PATS[info?.pattern] || PATS["core"] || Object.values(PATS)[0] || { icon: "E", color: textMuted, label: "Otro", labelEn: "Other" };
            const removeEx = () => setRoutines(p => p.map(rr => rr.id === r.id ? { ...rr, days: rr.days.map((dd, ddi) => ddi === di ? { ...dd, [bloque]: dd[bloque].filter((_, eei) => eei !== ei) } : dd) } : rr));
            const canUp = ei > 0;
            const canDown = ei < exList.length - 1;
            return (
              <ExerciseCard
                key={ei}
                ex={ex}
                info={info}
                es={es}
                darkMode={darkMode}
                border={border}
                textMain={textMain}
                textMuted={textMuted}
                bgSub={bgSub}
                fmtP={fmtP}
                canUp={canUp}
                canDown={canDown}
                onMoveUp={() => canUp && moveEx(bloque, ei, ei - 1)}
                onMoveDown={() => canDown && moveEx(bloque, ei, ei + 1)}
                onEdit={() => setEditEx({ rId: r.id, dIdx: di, eIdx: ei, bloque, ex: { ...ex } })}
                onRemove={removeEx}
              />
            );
          });
          const toggleBlock = (blk) => setRoutines(p => p.map(rr => rr.id === r.id ? { ...rr, days: rr.days.map((dd, ddi) => ddi === di ? { ...dd, [blk]: !dd[blk] } : dd) } : rr));
          const hasWarmup = (d.warmup || []).length > 0;
          return (
            <div key={di + "-" + d.exercises.length + "-" + (d.warmup || []).length} style={{ borderLeft: "2px solid #1a1d2e", paddingLeft: 8, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <input value={d.label || ""} onChange={function (e) { var val = e.target.value; setRoutines(function (p) { return p.map(function (rr) { return rr.id === r.id ? { ...rr, days: rr.days.map(function (dd, ddi) { return ddi === di ? { ...dd, label: val } : dd }) } : rr }); }); }} placeholder={(es ? "Dia " : "Day ") + (di + 1)} style={{ fontSize: 22, fontWeight: 700, color: textMuted, letterSpacing: 1, background: "transparent", border: "none", borderBottom: "1px dashed " + border, outline: "none", width: "50%", fontFamily: "inherit", padding: "2px 0" }} />
                <button className="hov" onClick={() => {
                  if (r.days.length < 2) { toast2(es ? "No hay otros días" : "No other days"); return; }
                  setDupDayModal({ rId: r.id, dIdx: di, days: r.days, selected: [], sourceDay: d });
                }} style={{ background: "#2563EB15", border: "1px solid #2563EB33", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#2563EB", cursor: "pointer", fontFamily: "inherit" }}>
                  <Ic name="copy" size={12} color="#2563EB" /> {es ? "Duplicar día" : "Duplicate day"}
                </button>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasWarmup || d.showWarmup ? 6 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 4, height: 16, borderRadius: 2, background: "#F59E0B", flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 800, color: textMain, letterSpacing: .5 }}>{es ? "ENTRADA EN CALOR" : "WARM UP"}</span>
                    {hasWarmup && <span style={{ fontSize: 15, color: textMuted, fontWeight: 700 }}>({(d.warmup || []).length})</span>}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="hov" style={{ ...btn("#2563EB22"), color: "#8B9AB2", fontSize: 13, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 5 }} onClick={() => { setAddExModal({ rId: r.id, dIdx: di, bloque: "warmup" }); setAddExSearch(""); setAddExPat(null); setAddExSelectedIds([]); }}><Ic name="plus" size={14} color="#8B9AB2" />{es ? "Añadir" : "Add"}</button>
                    {hasWarmup && <button className="hov" style={{ ...btn(), fontSize: 13, padding: "4px 9px", background: darkMode ? "#162234" : "#E2E8F0", color: textMuted }} onClick={() => toggleBlock("showWarmup")}>{d.showWarmup ? "▲" : "▼"}</button>}
                  </div>
                </div>
                {(d.showWarmup || false) && hasWarmup && renderExList(d.warmup || [], "warmup")}
                {!hasWarmup && <div style={{ fontSize: 13, color: "#8B9AB2", padding: "8px 0" }}>{es ? "Sin ejercicios. Usá «Añadir» para sumar calentamiento." : "No exercises. Use «Add» to add warm-up."}</div>}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 4, height: 16, borderRadius: 2, background: "#2563EB", flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 800, color: textMain, letterSpacing: .5 }}>{es ? "BLOQUE PRINCIPAL" : "MAIN BLOCK"}</span>
                    <span style={{ fontSize: 15, color: textMuted, fontWeight: 700 }}>({d.exercises.length})</span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="hov" style={{ ...btn("#22C55E20"), color: "#22C55E", fontSize: 13, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 5 }} onClick={() => { setAddExModal({ rId: r.id, dIdx: di, bloque: "exercises" }); setAddExSearch(""); setAddExPat(null); setAddExSelectedIds([]); }}><Ic name="plus" size={14} color="#22C55E" />{es ? "Añadir" : "Add"}</button>
                    {d.exercises.length > 0 && <button className="hov" style={{ ...btn(), fontSize: 13, padding: "4px 9px", background: darkMode ? "#162234" : "#E2E8F0", color: textMuted }} onClick={() => toggleBlock("showMain")}>{d.showMain !== false ? "▲" : "▼"}</button>}
                  </div>
                </div>
                {d.showMain !== false && renderExList(d.exercises, "exercises")}
                {d.exercises.length === 0 && <div style={{ fontSize: 13, color: "#8B9AB2", padding: "8px 0" }}>{es ? "Sin ejercicios. Usá «Añadir» para sumar al bloque principal." : "No exercises. Use «Add» for the main block."}</div>}
              </div>
            </div>
          );
        }) : null;
        return (<div key={r.id} style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{r.name}</div>
                {r.scanned && <span style={{ background: "#2563EB22", color: "#2563EB", border: "1px solid #60a5fa33", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><Ic name="image" size={12} color="#2563EB" />{es ? "Escaneada" : "Scanned"}</span>}
              </div>
              {r.alumno && <div style={{ fontSize: 15, fontWeight: 700, color: textMuted, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}><Ic name="user" size={15} color={textMuted} />{r.alumno}</div>}
              <div style={{ fontSize: 18, color: textMuted, fontWeight: 700 }}>{r.days.length} {es ? "dias" : "days"}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="hov" style={{ background: darkMode ? "#162234" : "#E2E8F0", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 500, color: textMuted, cursor: "pointer", fontFamily: "inherit" }}
                onClick={() => setRoutines(p => p.map(rr => rr.id === r.id ? { ...rr, collapsed: !rr.collapsed } : rr))}>
                {r.collapsed ? ("▼ " + (es ? "VER" : "VIEW")) : ("▲ " + (es ? "CERRAR" : "CLOSE"))}
              </button>
              <button className="hov" style={{ background: "#22C55E22", color: "#22C55E", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }} onClick={() => {
                const copia = { ...r, id: uid(), name: r.name + " (copia)", days: r.days.map(function (d) { return { ...d, warmup: (d.warmup || []).map(function (e) { return { ...e } }), exercises: (d.exercises || []).map(function (e) { return { ...e } }) }; }), collapsed: false, saved: false };
                setRoutines(function (p) { return [...p, copia]; });
                setAssignRoutineId(copia.id);
                toast2((es ? "Rutina duplicada" : "Routine duplicated") + " ✓");
              }}><Ic name="copy" size={15} /></button>
              <button className="hov" style={{ background: "#2563EB22", color: "#2563EB", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }} onClick={() => { setRoutines(p => p.filter(x => x.id !== r.id)); toast2((es ? "Rutina eliminada" : "Routine deleted") + " ✓"); }}><Ic name="trash-2" size={15} /></button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <select style={{ flex: 1, minWidth: 120 }} value={r.alumno_id || ""} onChange={e => {
              const v = e.target.value;
              setRoutines(p => p.map(rr => rr.id === r.id ? { ...rr, alumno_id: v, alumno: alumnos.find(a => a.id === v)?.nombre || "" } : rr));
            }}>
              <option value="">{es ? "Sin asignar" : "Unassigned"}</option>
              {alumnos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
            <button className="hov" style={{ ...btn(), padding: "8px 14px", fontSize: 15, fontWeight: 700 }} onClick={async () => {
              try {
                // Leer siempre la versión más reciente del estado para evitar closures viejos
                const rActual = routines.find(x => x.id === r.id) || r;
                const payload = { nombre: rActual.name, alumno_id: rActual.alumno_id || null, datos: { days: rActual.days, alumno: rActual.alumno || "", note: rActual.note || "" }, entrenador_id: "entrenador_principal" };
                if (rActual.saved) {
                  await sb.updateRutina(rActual.id, payload);
                } else {
                  const res = await sb.createRutina(payload);
                  if (res && res[0]) { setRoutines(p => p.map(rr => rr.id === rActual.id ? { ...rr, id: res[0].id, saved: true } : rr)); }
                }
                toast2(es ? "Rutina guardada ✓" : "Routine saved ✓");
              } catch (e) { toast2("Error al guardar"); }
            }}><Ic name="save" size={15} /> {es ? "Guardar" : "Save"}</button>
          </div>
          {daysJSX}
        </div>
        );
      })}
    </div>
  );
}
