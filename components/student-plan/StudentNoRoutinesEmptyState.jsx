import React from 'react';

function StudentNoRoutinesEmptyState({ msg, textMuted }) {
  return (
    <div style={{textAlign:"center",padding:"60px 0",color:textMuted}}>
      <div style={{fontSize:48,marginBottom:12}}>📋</div>
      <div style={{fontSize:22,fontWeight:700,letterSpacing:1,marginBottom:8}}>{msg("Sin rutinas aun", "No routines yet")}</div>
      <div style={{fontSize:15}}>{msg("Crea tu primera rutina en RUTINAS", "Create your first routine in ROUTINES")}</div>
    </div>
  );
}

export default StudentNoRoutinesEmptyState;
