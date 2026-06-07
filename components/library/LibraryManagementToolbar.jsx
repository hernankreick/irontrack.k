import React from 'react';
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
  return (
    <>
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
    </>
  );
}
