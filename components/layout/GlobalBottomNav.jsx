import React from 'react';

const GlobalBottomNav = React.forwardRef(function GlobalBottomNav({ darkMode, esAlumno, tabs2, tab, setTab }, ref) {
  return (
    <nav ref={ref} style={{
      position:"fixed",bottom:0,left:0,right:0,
      background: darkMode ? "rgba(15,25,35,0.96)" : "rgba(255,255,255,0.96)",
      backdropFilter: "blur(12px)",
      borderTop:"1px solid "+(darkMode?"#1E2D40":"#E2E8F0"),
      display:"flex",zIndex:40,
      paddingBottom:"env(safe-area-inset-bottom,0px)"
    }}>
      {tabs2.map(tb=>{
        const isActive = tab===tb.k;
        const activeCol = esAlumno ? "#3b82f6" : "#2563EB";
        const inactiveCol = darkMode?"#8B9AB2":"#64748B";
        return(
          <button key={tb.k} onClick={()=>setTab(tb.k)}
            style={{flex:1,background:"none",border:"none",
              padding:"8px 0 12px",cursor:"pointer",
              display:"flex",flexDirection:"column",
              alignItems:"center",gap:4,
              position:"relative"}}>
            <div style={{
              position:"absolute",top:0,left:"50%",
              transform:"translateX(-50%)",
              height:3,width:isActive?28:0,
              background:activeCol,borderRadius:"0 0 3px 3px",
              transition:"width .25s cubic-bezier(.4,0,.2,1)"
            }}/>
            <div style={{
              background:isActive?(darkMode?"rgba(59,130,246,0.2)":"rgba(59,130,246,0.12)"):esAlumno?"transparent":(darkMode?"transparent":"transparent"),
              borderRadius:esAlumno?8:8,
              padding:esAlumno?"6px 14px":"4px 12px",
              transition:"background-color .2s ease,border-color .2s ease,color .2s ease,opacity .2s ease,transform .2s ease",
              display:"flex",alignItems:"center",justifyContent:"center"
            }}>
              {tb.icon(isActive?activeCol:inactiveCol)}
            </div>
            <span style={{
              fontSize:11,fontWeight:isActive?700:500,
              letterSpacing:0.3,
              color:isActive?activeCol:inactiveCol,
              transition:"color .2s"
            }}>{tb.lbl}</span>
          </button>
        );
      })}
    </nav>
  );
});

export default GlobalBottomNav;
