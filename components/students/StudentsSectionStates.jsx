import React from 'react';

export default function StudentsSectionStates({
  loadingSB,
  alumnosLength,
  filteredLength,
  bgCard,
  border,
  textMuted,
  textMain,
  msg,
  Ic,
}) {
  return (
    <>
      {loadingSB&&(
        <div>
          {[1,2,3].map(i=>(
            <div key={"alumno-list-skel-"+i} style={{background:bgCard,borderRadius:12,padding:"16px",marginBottom:8,border:"1px solid "+border}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{flex:1}}>
                  <div className="sk" style={{height:16,width:"55%",marginBottom:8}}/>
                  <div className="sk" style={{height:12,width:"35%"}}/>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <div className="sk" style={{width:32,height:32,borderRadius:8}}/>
                  <div className="sk" style={{width:52,height:32,borderRadius:8}}/>
                  <div className="sk" style={{width:32,height:32,borderRadius:8}}/>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {alumnosLength===0&&!loadingSB&&(
        <div style={{textAlign:"center",padding:"30px 0",color:textMuted}}>
          <div style={{fontSize:36,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Ic name="users" size={34} color={textMuted}/>
          </div>
          <div style={{fontSize:15,fontWeight:700,color:textMain}}>{msg("Sin alumnos aún", "No athletes yet")}</div>
        </div>
      )}
      {alumnosLength>0 && filteredLength===0 && !loadingSB && (
        <div style={{textAlign:"center",padding:"24px 12px",color:textMuted,fontSize:15,fontWeight:600}}>
          {msg("No hay alumnos que coincidan con la búsqueda o el filtro.", "No athletes match your search or filter.")}
        </div>
      )}
    </>
  );
}
