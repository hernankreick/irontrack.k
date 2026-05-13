import React from "react";
import { createPortal } from "react-dom";
import { Ic } from "../Ic.jsx";

export default function AlumnoProfileModal({
  open,
  sessionData,
  profileEdit,
  setProfileEdit,
  profileFileRef,
  bgSub,
  border,
  textMain,
  msg,
  onClose,
  onSave,
}) {
  if (!open || !sessionData || typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: "rgba(10,22,40,.78)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: "env(safe-area-inset-bottom,0px)",
      }}
      onClick={function () { onClose(); }}
    >
      <div
        style={{
          background: "#0a1628",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 480,
          border: "1px solid rgba(59,130,246,.22)",
          animation: "slideUpFade 0.35s ease",
          maxHeight: "min(90dvh, 100svh - env(safe-area-inset-top, 0px) - 12px)",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -8px 40px rgba(0,0,0,.45)",
          overflow: "hidden",
        }}
        onClick={function (e) { e.stopPropagation(); }}
      >
        <div style={{ flexShrink: 0, padding: "12px 18px 0" }}>
          <div style={{ width: 40, height: 4, background: "#3b82f6", borderRadius: 2, margin: "0 auto 16px" }} />
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, color: "#fff", letterSpacing: 0.5 }}>{msg("Mi perfil", "My profile")}</div>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            padding: "0 18px 12px",
          }}
        >
          <input ref={profileFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={function (e) {
            var f = e.target.files && e.target.files[0];
            if (!f) return;
            var r = new FileReader();
            r.onload = function (ev) { setProfileEdit(function (p) { return { ...p, avatarDataUrl: ev.target.result }; }); };
            r.readAsDataURL(f);
          }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: profileEdit.avatarDataUrl ? "transparent" : "linear-gradient(135deg,#3b82f6,#1d4ed8)", overflow: "hidden", border: "3px solid rgba(59,130,246,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#fff" }}>
              {profileEdit.avatarDataUrl
                ? <img src={profileEdit.avatarDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (sessionData.name || "A").slice(0, 2).toUpperCase()}
            </div>
            <button type="button" className="hov" style={{ marginTop: 10, background: "rgba(59,130,246,.15)", border: "1px solid rgba(59,130,246,.35)", borderRadius: 10, padding: "8px 16px", color: "#3b82f6", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              onClick={function () { profileFileRef.current && profileFileRef.current.click(); }}>
              {msg("Cambiar foto", "Change photo")}
            </button>
          </div>
          {[
            { k: "nombre", lbl: msg("Nombre", "First name"), ph: "" },
            { k: "apellido", lbl: msg("Apellido", "Last name"), ph: "" },
            { k: "email", lbl: "Email", ph: "email@", type: "email" },
            { k: "phone", lbl: msg("Celular", "Phone"), ph: "+54 ...", type: "tel" },
          ].map(function (row) {
            return (
              <div key={row.k} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6, letterSpacing: 0.5 }}>{row.lbl}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: bgSub, border: "1px solid " + border, borderRadius: 12, padding: "4px 4px 4px 12px" }}>
                  {row.k === "email" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> :
                    row.k === "phone" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                      : <Ic name="user" size={18} color="#64748b" />}
                  <input style={{ flex: 1, background: "transparent", border: "none", color: textMain, fontSize: 15, padding: "10px 8px", outline: "none", fontFamily: "inherit" }}
                    value={row.k === "phone" ? profileEdit.phone : (row.k === "email" ? profileEdit.email : profileEdit[row.k])}
                    onChange={function (e) {
                      var v = e.target.value;
                      if (row.k === "phone") setProfileEdit(function (p) { return { ...p, phone: v }; });
                      else if (row.k === "email") setProfileEdit(function (p) { return { ...p, email: v }; });
                      else setProfileEdit(function (p) { return { ...p, [row.k]: v }; });
                    }}
                    type={row.type || "text"}
                    placeholder={row.ph}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ flexShrink: 0, padding: "12px 18px calc(14px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid rgba(59,130,246,.25)", background: "#0a1628" }}>
          <button type="button" className="hov" style={{ width: "100%", padding: "14px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px rgba(59,130,246,.35)" }}
            onClick={onSave}>
            {msg("Guardar cambios", "Save changes")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
