import React from 'react';
import { Ic } from '../Ic.jsx';

function RoutinePdfDownloadButton({ msg, onDownload }) {
  return (
    <button
      type="button"
      onClick={onDownload}
      style={{
        width:"100%",
        marginTop:20,
        marginBottom:12,
        padding:"20px 20px 22px",
        background:"linear-gradient(180deg, rgba(37,99,235,0.22) 0%, rgba(15,23,42,0.9) 100%)",
        color:"#fff",
        border:"1px solid rgba(96,165,250,0.45)",
        borderRadius:16,
        fontFamily:"Barlow Condensed, DM Sans, system-ui, sans-serif",
        cursor:"pointer",
        display:"flex",
        flexDirection:"column",
        alignItems:"center",
        justifyContent:"center",
        gap:6,
        boxSizing:"border-box",
        textAlign:"center",
        boxShadow:"0 12px 32px rgba(0,0,0,0.25)",
      }}
    >
      <div
        style={{
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          gap:10,
        }}
      >
        <Ic name="download" size={22} color="#fff"/>
        <span
          style={{
            fontSize:16,
            fontWeight:900,
            letterSpacing:0.6,
            textTransform:"uppercase",
            lineHeight:1.2,
          }}
        >
          {msg("Descargar rutina (PDF)", "Download routine (PDF)", "Baixar rotina (PDF)")}
        </span>
      </div>
      <span
        style={{
          fontSize:12,
          fontWeight:600,
          color:"rgba(226,232,240,0.9)",
          maxWidth:280,
          lineHeight:1.35,
        }}
      >
        {msg("Lleva tu plan a donde quieras", "Take your plan anywhere", "Leve seu plano para onde quiser")}
      </span>
    </button>
  );
}

export default RoutinePdfDownloadButton;
