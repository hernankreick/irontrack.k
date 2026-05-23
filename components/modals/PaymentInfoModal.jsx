import React from 'react';

export default function PaymentInfoModal({
  form,
  setForm,
  bgCard,
  bgSub,
  border,
  textMain,
  textMuted,
  darkMode,
  green,
  msg,
  onClose,
  onSave,
}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div style={{background:bgCard,borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxHeight:"85dvh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>💰 {msg("Datos de Pago", "Payment Info")}</div>
        <div style={{fontSize:13,color:textMuted,marginBottom:16}}>{msg("Configurá tu alias o CBU para recibir pagos", "Set up your alias or CBU to receive payments")}</div>
        <div>
          <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>ALIAS</div>
          <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:8}} value={form.alias} onChange={e=>setForm(p=>({...p,alias:e.target.value}))} placeholder="tu.alias.mp"/>
          <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>CBU (opcional)</div>
          <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:8}} value={form.cbu} onChange={e=>setForm(p=>({...p,cbu:e.target.value}))} placeholder="0000000000000000000000"/>
          <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>{msg("BANCO / BILLETERA", "BANK / WALLET")}</div>
          <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:8}} value={form.banco} onChange={e=>setForm(p=>({...p,banco:e.target.value}))} placeholder="Mercado Pago / Banco Nación / etc"/>
          <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>{msg("MONTO MENSUAL", "MONTHLY FEE")}</div>
          <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:8}} value={form.monto} onChange={e=>setForm(p=>({...p,monto:e.target.value}))} placeholder="$ 15.000"/>
          <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>{msg("NOTA (opcional)", "NOTE (optional)")}</div>
          <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:16}} value={form.nota} onChange={e=>setForm(p=>({...p,nota:e.target.value}))} placeholder={msg("Ej: Transferir antes del 5 de cada mes", "E.g.: Transfer before the 5th of each month")}/>
          <div style={{display:"flex",gap:8}}>
            <button className="hov" style={{background:darkMode?"#162234":"#E2E8F0",color:textMain,border:"none",borderRadius:12,padding:"12px",flex:1,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={onClose}>{msg("Cancelar", "Cancel")}</button>
            <button className="hov" style={{background:green,color:darkMode?"#fff":"#fff",border:"none",borderRadius:12,padding:"12px",flex:2,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={onSave}>{msg("Guardar", "Save")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
