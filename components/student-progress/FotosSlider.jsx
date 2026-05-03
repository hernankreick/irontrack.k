import React from 'react';
import { getTheme } from '../../lib/uiHelpers.js';

function FotosSlider({fotos, es, darkMode, toast2, sb, sessionData, setFotos, msg}) {
  const {bg, bgCard, bgSub, border, textMain, textMuted} = getTheme(darkMode);
const [sliderPos, setSliderPos] = React.useState(50);
const [isDragging, setIsDragging] = React.useState(false);
const sliderRef = React.useRef();
const fotoAntes = fotos[fotos.length-1];
const fotoDespues = fotos[0];
const calcPos = (clientX) => {
  const rect = sliderRef.current?.getBoundingClientRect();
  if(!rect) return 50;
  return Math.min(100, Math.max(0, ((clientX-rect.left)/rect.width)*100));
};
return(
  <div style={{marginBottom:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div style={{fontSize:11,fontWeight:600,color:textMuted,letterSpacing:1,textTransform:"uppercase"}}>
        {fotos.length} fotos · {msg("comparador", "before/after")}
      </div>
      <div style={{fontSize:11,color:textMuted}}>← {msg("arrastrá", "drag")} →</div>
    </div>
    <div ref={sliderRef}
      style={{position:"relative",width:"100%",aspectRatio:"3/4",borderRadius:12,overflow:"hidden",
        cursor:"ew-resize",userSelect:"none",touchAction:"none",border:"1px solid "+border}}
      onMouseDown={e=>{setIsDragging(true);setSliderPos(calcPos(e.clientX));}}
      onMouseMove={e=>{if(isDragging)setSliderPos(calcPos(e.clientX));}}
      onMouseUp={()=>setIsDragging(false)}
      onMouseLeave={()=>setIsDragging(false)}
      onTouchStart={e=>{setIsDragging(true);setSliderPos(calcPos(e.touches[0].clientX));}}
      onTouchMove={e=>{e.preventDefault();if(isDragging)setSliderPos(calcPos(e.touches[0].clientX));}}
      onTouchEnd={()=>setIsDragging(false)}
    >
      <img src={fotoDespues.imagen} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
      <div style={{position:"absolute",inset:0,clipPath:`inset(0 ${100-sliderPos}% 0 0)`}}>
        <img src={fotoAntes.imagen} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
      </div>
      <div style={{position:"absolute",top:0,bottom:0,left:`${sliderPos}%`,transform:"translateX(-50%)",width:3,background:"#fff",boxShadow:"0 0 8px rgba(0,0,0,.6)"}}>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
          width:38,height:38,borderRadius:"50%",background:"#fff",border:"2px solid #2563EB",
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:"0 2px 12px rgba(0,0,0,.4)",fontSize:15,color:"#2563EB",fontWeight:700}}>⇔</div>
      </div>
      <div style={{position:"absolute",bottom:8,left:8,background:"rgba(0,0,0,.7)",color:"#fff",fontSize:11,fontWeight:600,padding:"4px 8px",borderRadius:6}}>
        {msg("ANTES", "BEFORE")} · {fotoAntes.fecha}
      </div>
      <div style={{position:"absolute",bottom:8,right:8,background:"rgba(37,99,235,.85)",color:"#fff",fontSize:11,fontWeight:600,padding:"4px 8px",borderRadius:6}}>
        {msg("AHORA", "NOW")} · {fotoDespues.fecha}
      </div>
    </div>
  </div>
);
}

export default FotosSlider;
