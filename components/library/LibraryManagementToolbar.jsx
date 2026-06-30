import React, { useState } from 'react';
import { Ic } from '../Ic.jsx';

export default function LibraryManagementToolbar({
  busq,
  setBusq,
  filtPat,
  setFiltPat,
  filtMus,
  setFiltMus,
  modoFiltro,
  setModoFiltro,
  sortModo,
  setSortModo,
  patrones,
  musculos,
  patLabel,
  musLabel,
  patColors,
  chipBtnPad,
  inpS,
  bgSub,
  border,
  _dm,
  libNarrow,
  exFiltrados,
  allEx,
  msg,
  textMuted,
}) {
  const [filterExpanded, setFilterExpanded] = useState(false);
  const isFilterActive = modoFiltro === "patron" ? filtPat !== "todos" : filtMus !== "todos";
  const activeFilterLabel = isFilterActive
    ? (modoFiltro === "patron" ? patLabel(filtPat) : musLabel(filtMus))
    : msg("Todos los ejercicios", "All exercises", "Todos os exercícios");

  return (
    <>
      {libNarrow && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <div style={{ flex: 1 }}>
            <input
              type="search"
              style={{...inpS, marginBottom: 0}}
              placeholder={msg("🔍 Buscar ejercicio...", "🔍 Search exercise...")}
              value={busq}
              onChange={e=>setBusq(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={function () { setSortModo(function (m) { return (m + 1) % 3; }); }}
            title={sortModo === 0 ? (msg("Sin orden definido — clic para A-Z", "Default order — click for A-Z")) : sortModo === 1 ? (msg("Orden: A-Z — clic para Z-A", "Order: A-Z — click for Z-A")) : (msg("Orden: Z-A — clic para quitar orden", "Order: Z-A — click to clear sort"))}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "8px 14px", borderRadius: 10,
              border: "1px solid " + (sortModo === 0 ? border : "#2563EB"),
              background: sortModo === 0 ? bgSub : "#2563EB22",
              color: sortModo === 0 ? textMuted : "#2563EB",
              fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer",
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            <Ic name="arrow-up-down" size={18} color={sortModo === 0 ? "#8B9AB2" : "#2563EB"} />
            {msg("Ordenar", "Sort")}
          </button>
        </div>
      )}
      {/* Filter toggle button (collapsed view) */}
      <button
        type="button"
        onClick={() => setFilterExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#111827', border: '1px solid #1E293B', borderRadius: '8px',
          padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0' }}>{activeFilterLabel}</span>
          {isFilterActive && (
            <span style={{ background: '#2563EB', color: '#fff', borderRadius: 12, padding: '1px 7px', fontSize: 12, fontWeight: 700 }}>1</span>
          )}
        </div>
        <span style={{ color: '#6B7280', fontSize: 16, transform: filterExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
      </button>

      {/* Filter expanded panel */}
      {filterExpanded && (
        <div style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: '8px', padding: '14px', marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '.5px', textTransform: 'uppercase' }}>{msg("Filtrar ejercicios", "Filter exercises", "Filtrar exercícios")}</span>
            <button type="button" onClick={() => setFilterExpanded(false)} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>✕</button>
          </div>
          {!libNarrow && (
            <input
              type="search"
              style={{...inpS, marginBottom: 12}}
              placeholder={msg("🔍 Buscar ejercicio...", "🔍 Search exercise...")}
              value={busq}
              onChange={e=>setBusq(e.target.value)}
            />
          )}
          <div
            className="min-w-0"
            style={{ display:"flex", background:bgSub, border:"1px solid "+border, borderRadius: 12, padding: 4, gap: 4, marginBottom: 12 }}
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
      )}

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
        {!libNarrow && (
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
            }}
          >
            <Ic name="arrow-up-down" size={18} color={sortModo === 0 ? "#8B9AB2" : "#2563EB"} />
            {msg("Ordenar", "Sort")}
          </button>
        )}
      </div>
    </>
  );
}
