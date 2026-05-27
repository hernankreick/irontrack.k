import React from 'react';
import { createPortal } from 'react-dom';
import { EX } from '../../lib/exerciseStaticData.js';
import {
  BIB_MUSCLE_OPTIONS,
  BIB_MUSCLE_ORDER,
  bibMuscleFilterHaystack,
  formatBibMuscleDisplay,
} from '../../lib/appHelpers.js';
import { resolveVideoUrl, sanitizeExerciseSnapshotForWrite } from '../../lib/exerciseResolve.js';
import { localeForSort, pickExerciseName } from '../../lib/irontrackMsg.js';
import { useIronTrackI18n } from '../../contexts/IronTrackI18nContext.jsx';
import { Ic } from '../Ic.jsx';

export default function GestionBiblioteca({allEx, setPatternOverrides, sb, entrenadorId, customEx, setCustomEx, toast2, darkMode, videoOverrides, setVideoOverrides, openNewExerciseTick = 0}) {
  const { msg, lang } = useIronTrackI18n();
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [tab, setTab] = React.useState(0);
  React.useEffect(
    function () {
      if (openNewExerciseTick > 0) setTab(1);
    },
    [openNewExerciseTick]
  );
  const [busq, setBusq] = React.useState("");
  const [filtPat, setFiltPat] = React.useState("todos");
  const [filtMus, setFiltMus] = React.useState("todos");
  const [modoFiltro, setModoFiltro] = React.useState("patron");
  const [editModal, setEditModal] = React.useState(null);
  const [editNombre, setEditNombre] = React.useState("");
  const [editPat, setEditPat] = React.useState("empuje");
  const [editYT, setEditYT] = React.useState("");
  const [editSaveLoading, setEditSaveLoading] = React.useState(false);
  const [newNombre, setNewNombre] = React.useState("");
  const [newPat, setNewPat] = React.useState("empuje");
  const [newMusKeys, setNewMusKeys] = React.useState([]);
  const [sortModo, setSortModo] = React.useState(0);
  const [newEquip, setNewEquip] = React.useState("");
  const [newYT, setNewYT] = React.useState("");
  const [newSaveLoading, setNewSaveLoading] = React.useState(false);
  const [borrarId, setBorrarId] = React.useState(null);
  const ytOverrides = videoOverrides || {};
  const [libNarrow, setLibNarrow] = React.useState(function () {
    return typeof window !== "undefined" && window.innerWidth < 700;
  });
  React.useEffect(function () {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    var mq = window.matchMedia("(max-width: 699px)");
    var onCh = function () { setLibNarrow(mq.matches); };
    onCh();
    mq.addEventListener("change", onCh);
    return function () { mq.removeEventListener("change", onCh); };
  }, []);

  const patrones = ["todos","empuje","traccion","rodilla","bisagra","core","movilidad","cardio","oly"];
  const musculos = ["todos","Cuadriceps","Gluteo","Isquios","Pecho","Dorsal","Hombro","Biceps","Triceps","Core","Pantorrilla"];
  const patColors = {empuje:"#8B9AB2",traccion:"#8B9AB2",rodilla:"#8B9AB2",bisagra:"#8B9AB2",core:"#8B9AB2",movilidad:"#8B9AB2",cardio:"#8B9AB2",oly:"#8B9AB2"};
  const patLabel = p => ({
    todos:msg("TODOS", "ALL"), empuje:msg("EMPUJE", "PUSH"), traccion:msg("TRACCION", "PULL"),
    rodilla:msg("RODILLA", "KNEE"), bisagra:msg("BISAGRA", "HINGE"), core:"CORE",
    movilidad:msg("MOVILIDAD", "MOBILITY"), cardio:"CARDIO", oly:msg("OLIMPICO", "OLYMPIC"),
  })[p] || p.toUpperCase();
  const musLabel = m => m==="todos"?(msg("TODOS", "ALL")):m==="Dorsal"?(msg("DORSAL", "BACK")):m==="Gluteo"?(msg("GLUTEO", "GLUTE")):m==="Isquios"?(msg("ISQUIOS", "HAMSTRINGS")):m==="Pecho"?(msg("PECHO", "CHEST")):m==="Hombro"?(msg("HOMBRO", "SHOULDER")):m==="Pantorrilla"?(msg("PANTORRILLA", "CALVES")):m.toUpperCase();
  const BIB_PATTERN_EDIT_KEYS = { empuje: 1, traccion: 1, rodilla: 1, bisagra: 1, core: 1, movilidad: 1, cardio: 1, oly: 1 };
  const patKeysEditList = ["empuje", "traccion", "rodilla", "bisagra", "core", "movilidad", "cardio", "oly"];
  const normalizeEditPattern = function (p) { return p && BIB_PATTERN_EDIT_KEYS[p] ? p : "empuje"; };
  const normalizeNameKey = function (value) {
    return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
  };
  const mapCustomRow = function (row, fallback) {
    var src = row || fallback || {};
    return sanitizeExerciseSnapshotForWrite({
      id: src.id,
      name: src.name || src.nombre || fallback?.name || "",
      nameEn: src.name_en || src.nameEn || src.name || fallback?.nameEn || fallback?.name || "",
      pattern: src.pattern || fallback?.pattern || "empuje",
      muscle: src.muscle || fallback?.muscle || "",
      equip: src.equip || fallback?.equip || "Libre",
      video_url: src.video_url || src.youtube_url || src.youtube || src.videoUrl || fallback?.video_url || null,
      isCustom: src.is_custom != null ? !!src.is_custom : true,
    });
  };

  const exFiltrados = allEx.filter(e=>{
    const nombre = pickExerciseName(e, lang);
    const matchQ = !busq || nombre.toLowerCase().includes(busq.toLowerCase());
    const matchPat = filtPat==="todos" || e.pattern===filtPat;
    const matchMus = filtMus==="todos" || bibMuscleFilterHaystack(e.muscle).includes(filtMus.toLowerCase());
    return matchQ && (modoFiltro==="patron"?matchPat:matchMus);
  });

  const exFiltradosSorted = React.useMemo(function () {
    var list = exFiltrados.slice();
    if (sortModo === 0) return list;
    var loc = localeForSort(lang);
    list.sort(function (a, b) {
      var na = pickExerciseName(a, lang) || "";
      var nb = pickExerciseName(b, lang) || "";
      var cmp = na.localeCompare(nb, loc, { sensitivity: "base" });
      return sortModo === 1 ? cmp : -cmp;
    });
    return list;
  }, [exFiltrados, sortModo, lang]);

  const counts = {};
  allEx.forEach(e=>{ counts[e.name.toLowerCase()]=(counts[e.name.toLowerCase()]||0)+1; });
  const dupCount = Object.values(counts).filter(v=>v>1).length;

  const guardarEdicion = async () => {
    if (!editModal || !editNombre.trim()) { toast2(msg("Ingresa un nombre", "Enter a name")); return; }
    const canPat = normalizeEditPattern(editPat);
    setEditSaveLoading(true);
    try {
      const isCustom = !!(customEx || []).find(c => c.id === editModal.id);
      if (isCustom) {
        const updated = customEx.map(e =>
          e.id === editModal.id
            ? sanitizeExerciseSnapshotForWrite({ ...e, name: editNombre, nameEn: editNombre, video_url: (editYT || "").trim(), pattern: canPat })
            : sanitizeExerciseSnapshotForWrite(e)
        );
        const row = updated.find(c => c.id === editModal.id);
        if (row) {
          await sb.updateCustomEx(editModal.id, { name: row.name, name_en: row.nameEn, video_url: row.video_url, pattern: canPat }, entrenadorId);
        }
        setCustomEx(updated);
      } else if (setPatternOverrides) {
        const orig = EX.find(function (x) { return x.id === editModal.id; });
        const basePat = orig && BIB_PATTERN_EDIT_KEYS[orig.pattern] ? orig.pattern : "empuje";
        if (canPat === basePat) {
          setPatternOverrides(function (prev) {
            var n = { ...(prev || {}) };
            delete n[editModal.id];
            return n;
          });
        } else {
          setPatternOverrides(function (prev) { return { ...(prev || {}), [editModal.id]: canPat }; });
        }
      }
      if (editYT) {
        try {
          await sb.setVideoOverride(editModal.id, editYT);
          if (setVideoOverrides) setVideoOverrides(function (prev) { return { ...prev, [editModal.id]: editYT }; });
        } catch (e) { console.error("[videoOverride]", e); }
      }
      setEditModal(null);
      toast2(msg("Ejercicio actualizado ✓", "Exercise updated ✓"));
    } catch (e) {
      console.error("[customExercises DEBUG] update failed", e);
      toast2(msg("No se pudo guardar el ejercicio personalizado en Supabase", "Could not save custom exercise in Supabase"));
    } finally {
      setEditSaveLoading(false);
    }
  };
  const borrarEjercicio = async (id) => {
    try {
      await sb.deleteCustomEx(id, entrenadorId);
      const updated = customEx.filter(e=>e.id!==id);
      setCustomEx(updated);
      setBorrarId(null); toast2(msg("Ejercicio eliminado ✓", "Exercise deleted ✓"));
    } catch (e) {
      console.error("[customExercises DEBUG] delete failed", e);
      toast2(msg("No se pudo eliminar el ejercicio personalizado en Supabase", "Could not delete custom exercise in Supabase"));
    }
  };
  const agregarEjercicio = async () => {
    if(!newNombre.trim()){toast2(msg("Ingresa un nombre", "Enter a name"));return;}
    if(!entrenadorId){toast2(msg("No se pudo identificar al entrenador para guardar en Supabase", "Could not identify the coach to save in Supabase"));return;}
    if(newSaveLoading) return;
    var muscleStored = newMusKeys.length ? JSON.stringify(BIB_MUSCLE_ORDER.filter(function (k) { return newMusKeys.indexOf(k) >= 0; })) : "";
    const newEx = sanitizeExerciseSnapshotForWrite({id:"custom_"+Date.now(), name:newNombre, nameEn:newNombre, pattern:newPat, muscle:muscleStored, equip:newEquip||"Libre", video_url:(newYT||"").trim(), isCustom:true});
    var nameKey = normalizeNameKey(newEx.name);
    var duplicate = (allEx || []).some(function (e) { return normalizeNameKey(e.name || e.nameEn) === nameKey; });
    if (duplicate) { toast2(msg("Ese ejercicio ya existe en la biblioteca", "That exercise already exists in the library")); return; }
    setNewSaveLoading(true);
    try {
      var created = await sb.addCustomEx({id:newEx.id, name:newEx.name, name_en:newEx.nameEn, pattern:newEx.pattern, muscle:newEx.muscle, equip:newEx.equip, video_url:newEx.video_url!=null?newEx.video_url:null, entrenador_id:entrenadorId, is_custom:true});
      const persistedEx = mapCustomRow(created, newEx);
      const updated = [...(customEx||[]), persistedEx];
      setCustomEx(updated);
      setNewNombre(""); setNewPat("empuje"); setNewMusKeys([]); setNewEquip(""); setNewYT("");
      setTab(0); toast2(msg("Ejercicio agregado ✓", "Exercise added ✓"));
    } catch(e){
      console.error("[customExercises DEBUG] insert failed", e);
      toast2(msg("No se pudo guardar el ejercicio personalizado en Supabase", "Could not save custom exercise in Supabase"));
    } finally {
      setNewSaveLoading(false);
    }
  };
  const inpS = {background:bg,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",color:textMain,fontSize:15,width:"100%",fontFamily:"inherit",outline:"none",marginBottom:8};
  const cardBorder = _dm ? "rgba(45, 64, 87, 0.9)" : border;
  const chipBtnPad = {padding:libNarrow ? "6px 11px" : "7px 13px", borderRadius:18, fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit"};

  return (
    <div className="min-w-0 max-w-full">
      <style dangerouslySetInnerHTML={{__html:(
        "@media (min-width:769px){.it-bib-ex-card{transition:background .16s ease,border-color .16s ease}"+
        (_dm?".it-bib-ex-card-d:hover{background:rgba(255,255,255,.04)!important;border-color:rgba(96,165,250,.32)!important}":".it-bib-ex-card-l:hover{background:rgba(37,99,235,.05)!important;border-color:rgba(96,165,250,.4)!important}") +
        "}"
      )}} />
      <div
        className="min-w-0 max-w-full"
        style={{
          display:"flex", flexDirection:"column", gap:libNarrow ? 18 : 20,
          padding: libNarrow ? "20px 16px 24px" : "30px 20px 28px",
        }}
      >
        <div
          className="min-w-0"
          style={{
            display:"flex",
            flexDirection: libNarrow ? "column" : "row",
            alignItems: libNarrow ? "stretch" : "flex-start",
            justifyContent:"space-between",
            gap: libNarrow ? 12 : 20,
            marginBottom: 4,
          }}
        >
          <div className="min-w-0" style={{flex: libNarrow ? "none" : 1, minWidth:0}}>
            <h2
              className="min-w-0"
              style={{fontSize: libNarrow ? 22 : 24, fontWeight: 800, color: textMain, lineHeight: 1.2, margin: 0, marginBottom: 6, letterSpacing: 0.2}}
            >
              {msg("Ejercicios", "Exercises", "Exercícios")}
            </h2>
            <p style={{fontSize: 14, lineHeight: 1.5, color: textMuted, margin: 0, maxWidth: 480}}>
              {msg("Gestioná tu biblioteca de movimientos, videos y categorías.", "Manage your library of movements, videos, and categories.", "Gerencie sua biblioteca de movimentos, vídeos e categorias.")}
            </p>
          </div>
          <button
            type="button"
            onClick={function () { setTab(1); }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 18px",
              borderRadius: 12,
              border: "none",
              background: "#2563EB",
              color: "#fff",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              flexShrink: 0,
              minHeight: 44,
              width: libNarrow ? "100%" : "auto",
            }}
          >
            {msg("+ Nuevo ejercicio", "+ New exercise", "+ Novo exercício")}
          </button>
        </div>

        <div style={{display:"flex",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),minWidth:0, paddingBottom:0}}>
          {[msg("GESTIONAR", "MANAGE"), msg("+ NUEVO", "+ NEW")].map((t,i)=>(
            <button key={i===0?"bib-tab-manage":"bib-tab-new"} onClick={()=>setTab(i)} style={{flex:1,minWidth:0,padding:"14px 8px",border:"none",background:"none",
              fontFamily:"inherit",fontSize:16,fontWeight:800,cursor:"pointer",
              color:tab===i?"#2563EB":"#8B9AB2",borderBottom:tab===i?"2px solid #3B82F6":"2px solid transparent"}}>
              {t}{i===0&&dupCount>0?(
                <span
                  title={msg(`Hay ${dupCount} nombres de ejercicio duplicados`, `There are ${dupCount} duplicate exercise names`)}
                  style={{marginLeft:8,background:"#2563EB",color:"#fff",borderRadius:12,padding:"1px 7px",fontSize:13,display:"inline-flex",alignItems:"center",justifyContent:"center"}}
                >
                  <Ic name="alert-triangle" size={12} color="#fff"/>
                </span>
              ):null}
            </button>
          ))}
        </div>

        {tab===0&&(
        <div className="min-w-0" style={{ display:"flex", flexDirection:"column", gap: libNarrow ? 16 : 20, marginTop: 0 }}>
          <div
            className="min-w-0"
            style={{
              borderRadius: 20,
              padding: libNarrow ? 16 : 22,
              border: "1px solid " + (_dm ? "rgba(45, 64, 87, 0.65)" : "rgba(226, 232, 240, 0.9)"),
              background: _dm
                ? "linear-gradient(165deg, rgba(32, 48, 64, 0.42) 0%, rgba(12, 22, 35, 0.58) 100%)"
                : "linear-gradient(165deg, rgba(255, 255, 255, 0.96) 0%, rgba(241, 245, 249, 0.9) 100%)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              boxShadow: _dm ? "0 4px 24px rgba(0,0,0,0.12)" : "0 2px 12px rgba(15, 23, 42, 0.06)",
              display: "flex", flexDirection: "column", gap: libNarrow ? 16 : 18, minWidth: 0,
            }}
          >
            <input
              type="search"
              style={{...inpS, marginBottom:0}}
              placeholder={msg("🔍 Buscar ejercicio...", "🔍 Search exercise...")}
              value={busq}
              onChange={e=>setBusq(e.target.value)}
            />
            <div
              className="min-w-0"
              style={{ display:"flex", background:bgSub, border:"1px solid "+border, borderRadius: 12, padding: 4, gap: 4 }}
            >
              {[msg("Por patrón", "By pattern", "Por padrão"), msg("Por músculo", "By muscle", "Por músculo")].map((t,i)=>(
                <button
                  type="button"
                  key={i===0?"bib-filt-patron":"bib-filt-muscle"}
                  onClick={()=>{setModoFiltro(i===0?"patron":"musculo");setFiltPat("todos");setFiltMus("todos");}}
                  style={{
                    flex:1, padding:"9px 8px", border:"none", borderRadius:8, fontFamily:"inherit", fontSize:14, fontWeight:700, cursor:"pointer",
                    background:modoFiltro===(i===0?"patron":"musculo")?"#2563EB":"transparent",
                    color:modoFiltro===(i===0?"patron":"musculo")?"#fff":"#8B9AB2",
                    minWidth:0,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {modoFiltro==="patron" && (
              <div className="min-w-0" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }}>
                {patrones.map(p=>(
                  <button
                    type="button"
                    key={p}
                    onClick={()=>setFiltPat(p)}
                    style={{...chipBtnPad,
                      border: filtPat===p ? "1px solid "+patColors[p] : filtPat==="todos"&&p==="todos" ? "1px solid #243040" : "1px solid "+border,
                      background: filtPat===p ? patColors[p]+"22" : filtPat==="todos"&&p==="todos" ? "#2563EB22" : _dm ? "#1E2D40" : bgSub,
                      color: filtPat===p ? patColors[p] : filtPat==="todos"&&p==="todos" ? "#2563EB" : "#8B9AB2",
                    }}
                  >
                    {patLabel(p)}
                  </button>
                ))}
              </div>
            )}
            {modoFiltro==="musculo" && (
              <div className="min-w-0" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }}>
                {musculos.map(m=>(
                  <button
                    type="button"
                    key={m}
                    onClick={()=>setFiltMus(m==="todos"?"todos":m)}
                    style={{...chipBtnPad,
                      border: filtMus===m ? "1px solid #60a5fa" : "1px solid "+border,
                      background: filtMus===m ? "#2563EB22" : _dm ? "#1E2D40" : bgSub,
                      color: filtMus===m ? "#2563EB" : "#8B9AB2",
                    }}
                  >
                    {musLabel(m)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            className="min-w-0"
            style={{
              display: "flex",
              flexDirection: libNarrow ? "column" : "row",
              alignItems: libNarrow ? "stretch" : "center",
              justifyContent: "space-between",
              gap: libNarrow ? 10 : 14,
              minWidth: 0,
            }}
          >
            <div style={{fontSize: 14, color: textMuted, fontWeight: 600, minWidth: 0, lineHeight: 1.4, flex: libNarrow ? "none" : 1, overflowWrap: "anywhere" }}>
              {msg("Mostrando", "Showing")} {exFiltrados.length} {msg("ejercicios de", "exercises of")} {allEx.length}
            </div>
            <button
              type="button"
              onClick={function () { setSortModo(function (m) { return (m + 1) % 3; }); }}
              title={sortModo === 0 ? (msg("Sin orden definido — clic para A-Z", "Default order — click for A-Z")) : sortModo === 1 ? (msg("Orden: A-Z — clic para Z-A", "Order: A-Z — click for Z-A")) : (msg("Orden: Z-A — clic para quitar orden", "Order: Z-A — click to clear sort"))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid " + (sortModo === 0 ? border : "#2563EB"),
                background: sortModo === 0 ? bgSub : "#2563EB22",
                color: sortModo === 0 ? textMuted : "#2563EB",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
                alignSelf: libNarrow ? "stretch" : "auto",
                width: libNarrow ? "100%" : "auto",
              }}
            >
              <Ic name="arrow-up-down" size={18} color={sortModo === 0 ? "#8B9AB2" : "#2563EB"} />
              {msg("Ordenar", "Sort")}
            </button>
          </div>

          <div className="min-w-0" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 2 }}>
          {exFiltradosSorted.map(e=>{
            const isCustom = !!(customEx||[]).find(c=>c.id===e.id);
            const nombre = pickExerciseName(e, lang);
            const muscleLine = formatBibMuscleDisplay(e.muscle, lang);
            const ytUrl = resolveVideoUrl(e, null, ytOverrides);
            return (
              <div
                key={e.id}
                className={"it-bib-ex-card min-w-0 " + (_dm ? "it-bib-ex-card-d" : "it-bib-ex-card-l")}
                style={{background:bgCard, border: "1px solid "+cardBorder, borderRadius: 17, padding: libNarrow ? "15px" : "17px", minWidth:0}}
              >
                <div style={{display:"flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", flexDirection: libNarrow ? "column" : "row" }}>
                  <div style={{flex: "1 1 8rem", minWidth:0}}>
                    <div
                      className="min-w-0"
                      style={{fontSize: 17, fontWeight: 800, color: textMain, marginBottom: 7, lineHeight: 1.3, wordBreak: "break-word", overflowWrap: "anywhere"}}
                    >
                      {nombre}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span
                        className="inline-flex"
                        style={{
                          background: _dm ? "rgba(22, 34, 52, 0.85)" : "rgba(226, 232, 240, 0.85)",
                          color: textMuted,
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                          border: "1px solid " + cardBorder,
                          letterSpacing: 0.2,
                        }}
                      >
                        {patLabel(e.pattern)}
                      </span>
                      {muscleLine && (
                        <span
                          className="inline-flex"
                          style={{
                            background: _dm ? "rgba(22, 34, 52, 0.5)" : "rgba(37, 99, 235, 0.08)",
                            color: _dm ? textMuted : "#0F1923",
                            padding: "2px 7px",
                            borderRadius: 8,
                            fontSize: 10,
                            fontWeight: 600,
                            border: "1px solid " + (_dm ? "rgba(45, 64, 87, 0.45)" : border),
                            maxWidth: "100%",
                          }}
                        >
                          {muscleLine}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="min-w-0"
                    style={{
                      display: "flex",
                      gap: 8,
                      flexShrink: 0,
                      alignItems: "center",
                      marginLeft: "auto",
                      width: libNarrow ? "100%" : "auto",
                      justifyContent: "flex-end",
                    }}
                  >
                    {ytUrl && (
                      <a href={ytUrl} target="_blank" rel="noreferrer" aria-label={msg("Ver video", "Watch video", "Ver vídeo")}
                        style={{
                          width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
                          background: _dm ? "rgba(22, 34, 52, 0.6)" : bgSub,
                          color: textMuted, border: "1px solid " + cardBorder, borderRadius: 12, textDecoration: "none", fontSize: 16, flexShrink: 0,
                        }}>▶</a>
                    )}
                    <button
                      type="button"
                      onClick={function () {
                        setEditModal(e);
                        setEditNombre(pickExerciseName(e, lang) || e.name || "");
                        setEditPat(normalizeEditPattern(e.pattern));
                        setEditYT(ytUrl || "");
                      }}
                      style={{
                        width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
                        background: _dm ? "rgba(22, 34, 52, 0.6)" : bgSub, color: textMuted, border: "1px solid " + cardBorder, borderRadius: 12, cursor: "pointer", fontSize: 15, flexShrink: 0,
                        fontFamily: "inherit", padding: 0,
                      }}
                    >
                      <Ic name="link" size={15}/>
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={()=>setBorrarId(e.id)}
                        style={{
                          width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
                          background: _dm ? "rgba(22, 34, 52, 0.6)" : bgSub, color: textMuted, border: "1px solid " + cardBorder, borderRadius: 12, cursor: "pointer", fontSize: 15, flexShrink: 0,
                          fontFamily: "inherit", padding: 0,
                        }}
                      >
                        <Ic name="trash-2" size={15}/>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
        )}

      {tab===1&&(
        <div>
          <div style={{fontSize:15,color:textMuted,marginBottom:16}}>{msg("El ejercicio quedara disponible en la biblioteca para armar rutinas.", "The exercise will be available in the library to build routines.")}</div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>{msg("NOMBRE *", "NAME *")}</div>
            <input style={inpS} value={newNombre} onChange={e=>setNewNombre(e.target.value)} placeholder={msg("Ej: Press inclinado con mancuernas", "Ex: Incline Dumbbell Press")}/>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>{msg("PATRON", "PATTERN")}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {["empuje","traccion","rodilla","bisagra","core","movilidad","cardio","oly"].map(p=>(
                <button key={p} onClick={()=>setNewPat(p)} style={{padding:"8px 14px",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  border:newPat===p?"1px solid "+(patColors[p]||"#2563EB"):"1px solid "+border,
                  background:newPat===p?(patColors[p]||"#2563EB")+"22":"#1E2D40",
                  color:newPat===p?(patColors[p]||"#2563EB"):"#8B9AB2"}}>
                  {patLabel(p)}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>{msg("MUSCULO", "MUSCLE")}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {BIB_MUSCLE_OPTIONS.map(function (o) {
                var sel = newMusKeys.indexOf(o.k) >= 0;
                return (
                  <button
                    key={o.k}
                    type="button"
                    onClick={function () {
                      setNewMusKeys(function (prev) {
                        return prev.indexOf(o.k) >= 0 ? prev.filter(function (x) { return x !== o.k; }) : prev.concat([o.k]);
                      });
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      border: sel ? "1px solid #2563EB" : "1px solid " + border,
                      background: sel ? "#2563EB22" : "#1E2D40",
                      color: sel ? "#2563EB" : "#8B9AB2",
                    }}
                  >
                    {msg(o.chipEs, o.chipEn)}
                  </button>
                );
              })}
            </div>
            <div style={{fontSize: 13, color: textMuted, marginTop: 8, lineHeight: 1.4 }}>
              {msg("Seleccionados: ", "Selected: ")}
              {BIB_MUSCLE_ORDER.filter(function (k) { return newMusKeys.indexOf(k) >= 0; })
                .map(function (k) {
                  var opt = BIB_MUSCLE_OPTIONS.find(function (x) { return x.k === k; });
                  return opt ? msg(opt.selEs, opt.selEn) : k;
                })
                .join(", ") || "—"}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>{msg("EQUIPAMIENTO", "EQUIPMENT")}</div>
            <input style={inpS} value={newEquip} onChange={e=>setNewEquip(e.target.value)} placeholder={msg("Ej: Barra, Mancuernas, Libre", "Ex: Barbell, Dumbbells, Bodyweight")}/>
          </div>
          <div style={{marginBottom:24}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>LINK YOUTUBE</div>
            <input style={inpS} value={newYT} onChange={e=>setNewYT(e.target.value)} placeholder="https://youtube.com/..."/>
            {newYT&&(newYT.includes("youtube")||newYT.includes("youtu.be"))&&(
              <div style={{marginTop:8,fontSize:13,color:"#22C55E",fontWeight:700}}>▶️ {msg("Link valido ✓", "Valid link ✓")}</div>
            )}
          </div>
          <button disabled={newSaveLoading} onClick={agregarEjercicio} style={{width:"100%",padding:12,background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:newSaveLoading?"not-allowed":"pointer",fontFamily:"inherit",opacity:newSaveLoading?0.85:1}}>
            {newSaveLoading ? msg("GUARDANDO...", "SAVING...") : msg("+ AGREGAR EJERCICIO", "+ ADD EXERCISE")}
          </button>
        </div>
      )}

      </div>

      {editModal && typeof document !== "undefined" && createPortal((
        <div
          onClick={function () { if (!editSaveLoading) setEditModal(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box",
            background: "rgba(2, 6, 23, 0.72)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={function (e) { e.stopPropagation(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bib-edit-ex-title"
            className="it-bib-edit-card"
            style={{
              maxWidth: 560,
              width: "min(560px, calc(100vw - 32px))",
              maxHeight: "calc(100dvh - 48px)",
              overflowY: "auto",
              boxSizing: "border-box",
              borderRadius: 22,
              padding: 24,
              background: _dm ? "rgba(15, 23, 42, 0.94)" : "#ffffff",
              border: _dm ? "1px solid rgba(148, 163, 184, 0.24)" : "1px solid " + border,
              boxShadow: "0 24px 80px rgba(0,0,0,.45)",
              color: _dm ? "#f1f5f9" : textMain,
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
            }}
          >
            <div id="bib-edit-ex-title" style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, lineHeight: 1.2 }}>{msg("Editar ejercicio", "Edit exercise", "Editar exercício")}</div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, color: _dm ? "#94a3b8" : textMuted }}>{msg("NOMBRE", "NAME", "NOME")}</label>
              <input
                autoComplete="off"
                style={{
                  background: _dm ? "rgba(2, 6, 23, 0.5)" : bgSub,
                  border: "1px solid " + (_dm ? "rgba(148, 163, 184, 0.3)" : border), borderRadius: 10, padding: "10px 12px", color: _dm ? "#f8fafc" : textMain, fontSize: 15, width: "100%", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
                value={editNombre}
                onChange={e=>setEditNombre(e.target.value)}
                disabled={editSaveLoading}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, color: _dm ? "#94a3b8" : textMuted }} htmlFor="bib-edit-pattern">{msg("PATRÓN", "PATTERN", "PADRÃO")}</label>
              <select
                id="bib-edit-pattern"
                value={editPat}
                onChange={e=>setEditPat(e.target.value)}
                disabled={editSaveLoading}
                style={{
                  display: "block", width: "100%", minHeight: 44,
                  background: _dm ? "rgba(2, 6, 23, 0.5)" : bgSub,
                  border: "1px solid " + (_dm ? "rgba(148, 163, 184, 0.3)" : border), borderRadius: 10, padding: "10px 12px", color: _dm ? "#f8fafc" : textMain, fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", cursor: "pointer",
                }}
              >
                {patKeysEditList.map(function (pk) {
                  return <option key={pk} value={pk}>{patLabel(pk)}</option>;
                })}
              </select>
            </div>
            <div style={{ marginBottom: 0 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, color: _dm ? "#94a3b8" : textMuted }}>{msg("LINK YOUTUBE", "YOUTUBE LINK", "LINK DO YOUTUBE")}</label>
              <div style={{ fontSize: 12, color: _dm ? "#7dd3fc" : "#2563EB", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.35 }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}><Ic name="info" size={14} color="currentColor"/></span>
                <span>{msg("Ideal: video corto -30 seg (YouTube Shorts)", "Ideal: short video -30 sec (YouTube Shorts)", "Ideal: vídeo curto ~30s (YouTube Shorts)")}</span>
              </div>
              <input
                autoComplete="off"
                style={{
                  background: _dm ? "rgba(2, 6, 23, 0.5)" : bgSub,
                  border: "1px solid " + (_dm ? "rgba(148, 163, 184, 0.3)" : border), borderRadius: 10, padding: "10px 12px", color: _dm ? "#f8fafc" : textMain, fontSize: 15, width: "100%", fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 8,
                }}
                value={editYT}
                onChange={e=>setEditYT(e.target.value)}
                placeholder="https://youtube.com/shorts/..."
                disabled={editSaveLoading}
              />
              {editYT && (editYT.includes("youtube") || editYT.includes("youtu.be")) && (()=>{
                var videoId = null;
                try {
                  if (editYT.includes("shorts/")) videoId = editYT.split("shorts/")[1].split("?")[0].split("&")[0];
                  else if (editYT.includes("v=")) videoId = editYT.split("v=")[1].split("&")[0];
                  else if (editYT.includes("youtu.be/")) videoId = editYT.split("youtu.be/")[1].split("?")[0];
                } catch (e) {}
                if (!videoId) return <div style={{ marginTop: 8, fontSize: 13, color: "#22C55E", fontWeight: 700 }}>✓ {msg("Link detectado", "Link detected", "Link detectado")}</div>;
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: _dm ? "#94a3b8" : textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{msg("PREVIEW", "PREVIEW", "PRÉVIA")}</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <img loading="lazy" alt="" src={"https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg"} style={{ width: 120, height: 68, borderRadius: 8, objectFit: "cover", border: "1px solid " + (_dm ? "rgba(148, 163, 184, 0.35)" : border) }} onError={function (e) { e.target.style.display = "none"; }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>✓ {msg("Video detectado", "Video detected", "Vídeo detectado")}</div>
                        <div style={{ fontSize: 11, color: _dm ? "#94a3b8" : textMuted, marginTop: 2 }}>ID: {videoId}</div>
                        <a href={editYT} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#3b82f6", textDecoration: "none", marginTop: 4, display: "inline-block" }}>{msg("Abrir en YouTube ↗", "Open in YouTube ↗", "Abrir no YouTube ↗")}</a>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {editYT && !(editYT.includes("youtube") || editYT.includes("youtu.be")) && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#F59E0B" }}>⚠ {msg("No parece un link de YouTube", "Doesn't look like a YouTube link", "Não parece um link do YouTube")}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24, paddingTop: 4 }}>
              <button
                type="button"
                disabled={editSaveLoading}
                onClick={function () { setEditModal(null); }}
                style={{ flex: 1, padding: 12, background: _dm ? "rgba(30, 41, 59, 0.9)" : "#E2E8F0", color: _dm ? "#cbd5e1" : textMain, border: "1px solid " + (_dm ? "rgba(148, 163, 184, 0.25)" : "transparent"), borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: editSaveLoading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: editSaveLoading ? 0.75 : 1 }}
              >{msg("CANCELAR", "CANCEL", "CANCELAR")}</button>
              <button
                type="button"
                disabled={editSaveLoading}
                onClick={function () { guardarEdicion(); }}
                style={{ flex: 1, padding: 12, background: "#2563EB", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: editSaveLoading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: editSaveLoading ? 0.85 : 1 }}
              >{editSaveLoading ? msg("Guardando...", "Saving...", "Guardando...") : msg("GUARDAR", "SAVE", "GUARDAR")}</button>
            </div>
          </div>
        </div>
      ), document.body)}

      {borrarId&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}} onClick={()=>setBorrarId(null)}>
          <div style={{background:bgCard,borderRadius:16,padding:20,width:"100%",maxWidth:320,border:"1px solid "+border,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:28,marginBottom:8}}>🗑️</div>
            <div style={{fontSize:15,fontWeight:800,marginBottom:8}}>{msg("Borrar ejercicio?", "Delete exercise?")}</div>
            <div style={{fontSize:13,color:textMuted,marginBottom:16}}>{msg("Esta accion no se puede deshacer", "This action cannot be undone")}</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setBorrarId(null)} style={{flex:1,padding:8,background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"none",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{msg("CANCELAR", "CANCEL")}</button>
              <button onClick={()=>borrarEjercicio(borrarId)} style={{flex:1,padding:8,background:"#2563EB",color:"#fff",border:"none",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{msg("BORRAR", "DELETE")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
