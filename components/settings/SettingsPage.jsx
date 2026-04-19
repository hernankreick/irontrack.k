import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient.js';

// ── PALETA ────────────────────────────────────────────────────────────────────
const C = {
  bg:      '#0B0E11',
  card:    '#111827',
  border:  '#1A2535',
  blue:    '#2563EB',
  blueL:   '#3B82F6',
  green:   '#22C55E',
  red:     '#EF4444',
  text:    '#F1F5F9',
  muted:   '#64748B',
  sub:     '#94A3B8',
};

// ── SECCIONES ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'perfil',         label: 'Perfil',          danger: false },
  { id: 'preferencias',   label: 'Preferencias',    danger: false },
  { id: 'negocio',        label: 'Negocio',         danger: false },
  { id: 'suscripcion',    label: 'Suscripción',     danger: false },
  { id: 'notificaciones', label: 'Notificaciones',  danger: false },
  { id: 'riesgo',         label: 'Zona de riesgo',  danger: true  },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
function initials(name) {
  const p = (name || 'CO').trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return 'CO';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function Row({ label, desc, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '14px 18px',
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 10, marginBottom: 6,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '1px',
      textTransform: 'uppercase', color: C.muted,
      marginBottom: 10, marginTop: 4,
    }}>{children}</div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.8px',
          textTransform: 'uppercase', color: C.muted, marginBottom: 6,
        }}>{label}</div>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '10px 14px', fontSize: 14,
          color: C.text, fontFamily: 'inherit', boxSizing: 'border-box',
          outline: 'none',
        }}
      />
    </div>
  );
}

function BtnGroup({ options, value, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4,
      background: C.bg, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: 3,
    }}>
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            cursor: 'pointer', fontSize: 12, fontWeight: 500,
            fontFamily: 'inherit',
            background: value === o.id ? C.blue : 'transparent',
            color: value === o.id ? '#fff' : C.muted,
          }}
        >{o.label}</button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none',
        cursor: 'pointer', padding: 0, flexShrink: 0,
        background: checked ? C.blue : C.border,
        position: 'relative', transition: 'background .2s',
      }}
    >
      <span style={{
        position: 'absolute', width: 16, height: 16,
        background: '#fff', borderRadius: '50%',
        top: 3, left: checked ? 21 : 3,
        transition: 'left .2s',
      }} />
    </button>
  );
}

function SaveBtn({ onClick, saved }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 10, alignItems: 'center' }}>
      {saved && <span style={{ fontSize: 12, color: C.green }}>Guardado ✓</span>}
      <button
        type="button"
        onClick={onClick}
        style={{
          background: C.blue, color: '#fff', border: 'none',
          borderRadius: 8, padding: '10px 24px',
          fontSize: 12, fontWeight: 700, letterSpacing: '0.5px',
          textTransform: 'uppercase', cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >{saved ? 'GUARDADO ✓' : 'GUARDAR'}</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: PERFIL
// ══════════════════════════════════════════════════════════════════════════════
function TabPerfil({ coach, setSessionData, toast2, entrenadorId }) {
  const [fullName, setFullName] = useState(coach?.name || '');
  const [titulo,   setTitulo]   = useState(coach?.titulo || '');
  const [email,    setEmail]    = useState(coach?.email || '');
  const [phone,    setPhone]    = useState(coach?.phone || '');
  const [passNew,  setPassNew]  = useState('');
  const [passConf, setPassConf] = useState('');
  const [saved,    setSaved]    = useState(false);

  const onSave = async () => {
    const next = { ...coach, name: fullName.trim(), titulo: titulo.trim(), email: email.trim(), phone: phone.trim() };
    try { localStorage.setItem('it_session', JSON.stringify(next)); } catch(e) {}
    setSessionData(next);
    if (passNew && passNew === passConf && passNew.length >= 6 && supabase) {
      const { error } = await supabase.auth.updateUser({ password: passNew });
      if (error) toast2('Error al cambiar contraseña');
      else { toast2('Contraseña actualizada ✓'); setPassNew(''); setPassConf(''); }
    } else if (passNew && passNew !== passConf) {
      toast2('Las contraseñas no coinciden'); return;
    }
    setSaved(true); setTimeout(() => setSaved(false), 2200);
    toast2('Perfil guardado ✓');
  };

  return (
    <div>
      {/* Avatar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '16px 18px', marginBottom: 20,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${C.blue}, #7C3AED)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Bebas Neue, sans-serif',
        }}>{initials(fullName || coach?.name)}</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{fullName || coach?.name}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{email || coach?.email}</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#1A2E1A', border: '1px solid #166534',
            borderRadius: 20, padding: '2px 10px', marginTop: 6,
            fontSize: 11, fontWeight: 600, color: C.green,
          }}>Pro Activo</div>
        </div>
      </div>

      <SectionTitle>Datos personales</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Input label="Nombre completo" value={fullName} onChange={setFullName} placeholder="Nombre y apellido" />
        <Input label="Título profesional" value={titulo} onChange={setTitulo} placeholder="Ej: Entrenador · Fuerza" />
        <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="correo@ejemplo.com" />
        <Input label="Teléfono" value={phone} onChange={setPhone} type="tel" placeholder="+54 9 11 ..." />
      </div>

      <SectionTitle>Contraseña</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Input label="Nueva contraseña" value={passNew} onChange={setPassNew} type="password" placeholder="Mínimo 6 caracteres" />
        <Input label="Confirmar contraseña" value={passConf} onChange={setPassConf} type="password" placeholder="Repetí la nueva" />
      </div>

      <SaveBtn onClick={onSave} saved={saved} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: PREFERENCIAS
// ══════════════════════════════════════════════════════════════════════════════
function TabPreferencias({ lang, setLang, darkMode, setDarkMode, toast2 }) {
  const [locale, setLocale] = useState(lang === 'en' ? 'en' : 'es');
  const [tema,   setTema]   = useState(darkMode ? 'night' : 'day');
  const [tz,     setTz]     = useState('America/Argentina/Buenos_Aires');
  const [saved,  setSaved]  = useState(false);

  const TZ = [
    { id: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
    { id: 'America/Santiago',   label: 'Santiago (CLT)' },
    { id: 'America/Lima',       label: 'Lima (PET)' },
    { id: 'America/Bogota',     label: 'Bogotá (COT)' },
    { id: 'America/Mexico_City',label: 'Ciudad de México (CST)' },
    { id: 'Europe/Madrid',      label: 'Madrid (CET)' },
  ];

  const onSave = () => {
    try { localStorage.setItem('it_lang', locale); } catch(e) {}
    setLang(locale);
    if (tema === 'night') { setDarkMode(true); try { localStorage.setItem('it_dark','true'); } catch(e) {} }
    else                  { setDarkMode(false); try { localStorage.setItem('it_dark','false'); } catch(e) {} }
    setSaved(true); setTimeout(() => setSaved(false), 2200);
    toast2('Preferencias guardadas ✓');
  };

  return (
    <div>
      <SectionTitle>Apariencia</SectionTitle>
      <Row label="Idioma" desc="Afecta textos de la app donde aplique">
        <BtnGroup
          options={[{id:'es',label:'ES Español'},{id:'en',label:'EN English'},{id:'pt',label:'PT Português'}]}
          value={locale} onChange={setLocale}
        />
      </Row>
      <Row label="Tema" desc="Claro, oscuro o siguiendo al sistema">
        <BtnGroup
          options={[{id:'night',label:'Noche'},{id:'day',label:'Día'},{id:'system',label:'Sistema'}]}
          value={tema} onChange={setTema}
        />
      </Row>

      <SectionTitle>Comportamiento</SectionTitle>
      <Row label="Zona horaria" desc="Referencia para calendarios y recordatorios">
        <select
          value={tz} onChange={e => setTz(e.target.value)}
          style={{
            background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '8px 12px', fontSize: 13,
            color: C.text, fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          {TZ.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </Row>
      <SaveBtn onClick={onSave} saved={saved} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: NEGOCIO
// ══════════════════════════════════════════════════════════════════════════════
function TabNegocio({ toast2, alumnosCount }) {
  const [nombre,  setNombre]  = useState('');
  const [tel,     setTel]     = useState('');
  const [capMax,  setCapMax]  = useState(30);
  const [moneda,  setMoneda]  = useState('ARS');
  const [saved,   setSaved]   = useState(false);
  const MONEDAS = ['ARS','USD','EUR','COP','MXN','CLP'];

  useEffect(() => {
    try {
      const raw = localStorage.getItem('it_coach_negocio');
      if (raw) {
        const d = JSON.parse(raw);
        if (d.nombre_gimnasio) setNombre(d.nombre_gimnasio);
        if (d.telefono_comercial) setTel(d.telefono_comercial);
        if (d.capacidad_max) setCapMax(d.capacidad_max);
        if (d.moneda) setMoneda(d.moneda);
      }
    } catch(e) {}
  }, []);

  const onSave = async () => {
    const payload = { nombre_gimnasio: nombre.trim(), telefono_comercial: tel.trim(), capacidad_max: capMax, moneda };
    try { localStorage.setItem('it_coach_negocio', JSON.stringify(payload)); } catch(e) {}
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('entrenadores').update({ nombre_gimnasio: payload.nombre_gimnasio, telefono_comercial: payload.telefono_comercial, capacidad_max: payload.capacidad_max, moneda: payload.moneda }).eq('id', user.id);
      } catch(e) {}
    }
    setSaved(true); setTimeout(() => setSaved(false), 2200);
    toast2('Negocio guardado ✓');
  };

  const cupos = Math.max(0, capMax - (alumnosCount || 0));

  return (
    <div>
      <SectionTitle>Identidad</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Input label="Nombre del gimnasio / marca" value={nombre} onChange={setNombre} placeholder="Iron Track Gym" />
        <Input label="Teléfono comercial" value={tel} onChange={setTel} placeholder="+54 ..." />
      </div>

      <SectionTitle>Operación</SectionTitle>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px', marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Capacidad máxima de alumnos</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.text, fontFamily: 'DM Mono, monospace' }}>{capMax}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          Libres: <span style={{ color: C.green, fontWeight: 600 }}>{cupos}</span>
          {' · '}Actuales: <span style={{ color: C.sub }}>{alumnosCount || 0}</span>
        </div>
        <input type="range" min={1} max={100} value={capMax} onChange={e => setCapMax(Number(e.target.value))}
          style={{ width: '100%', marginTop: 12, accentColor: C.blue }} />
      </div>

      <Row label="Moneda" desc="Para montos y reportes">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {MONEDAS.map(m => (
            <button key={m} type="button" onClick={() => setMoneda(m)} style={{
              padding: '5px 12px', borderRadius: 7, border: `1px solid ${moneda === m ? C.blue : C.border}`,
              background: moneda === m ? '#1D2D50' : 'transparent',
              color: moneda === m ? C.blueL : C.muted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>{m}</button>
          ))}
        </div>
      </Row>
      <SaveBtn onClick={onSave} saved={saved} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: SUSCRIPCIÓN
// ══════════════════════════════════════════════════════════════════════════════
function TabSuscripcion({ alumnosCount, rutinasActivasCount }) {
  const renewal = new Date(new Date().setMonth(new Date().getMonth() + 1))
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

  function Bar({ label, current, max, color }) {
    const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
          <span style={{ color: C.muted }}>{label}</span>
          <span style={{ color: C.text, fontWeight: 600 }}>{current} / {max}</span>
        </div>
        <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .8s ease' }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle>Plan actual</SectionTitle>
      <div style={{
        background: 'linear-gradient(135deg, #1D2D50 0%, #0F1829 100%)',
        border: `1px solid ${C.blue}`, borderRadius: 14, padding: '20px 22px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', background: C.blue, color: '#fff', display: 'inline-flex', padding: '2px 10px', borderRadius: 20, marginBottom: 10 }}>ACTIVO</div>
        <div style={{ fontSize: 24, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2, color: C.text }}>IRONTRACK PRO</div>
        <div style={{ fontSize: 28, fontFamily: 'DM Mono, monospace', color: C.blueL, marginTop: 4 }}>$29 <span style={{ fontSize: 13, color: C.muted }}>/ mes</span></div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>Próxima renovación: {renewal}</div>
      </div>

      <SectionTitle>Uso del plan</SectionTitle>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px', marginBottom: 6 }}>
        <Bar label="Alumnos" current={alumnosCount || 0} max={50} color={C.blue} />
        <Bar label="Rutinas activas" current={rutinasActivasCount || 0} max={40} color={C.blueL} />
      </div>

      <SectionTitle>Facturación</SectionTitle>
      <Row label="Método de pago" desc="Visa •••• 4242 — expira 08/27">
        <button type="button" style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 14px', fontSize: 12, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Actualizar</button>
      </Row>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: NOTIFICACIONES
// ══════════════════════════════════════════════════════════════════════════════
function TabNotificaciones() {
  const ITEMS = [
    { id: 'alumno',  label: 'Nuevos alumnos',          desc: 'Alta o aceptación de invitación' },
    { id: 'mensaje', label: 'Mensajes',                 desc: 'Mensajes nuevos en el chat' },
    { id: 'sesion',  label: 'Sesiones completadas',     desc: 'Cuando un alumno finaliza entreno' },
    { id: 'rutina',  label: 'Cambios en rutinas',       desc: 'Rutinas asignadas o completadas' },
    { id: 'pago',    label: 'Pagos y vencimientos',     desc: 'Recordatorios de cuotas' },
    { id: 'sistema', label: 'Sistema',                  desc: 'Actualizaciones de la plataforma' },
  ];
  const init = () => { const o = {}; ITEMS.forEach(i => { o[i.id] = true; }); return o; };
  const [sw, setSw] = useState(() => { try { const r = localStorage.getItem('it_notif_prefs'); return r ? { ...init(), ...JSON.parse(r).items } : init(); } catch(e) { return init(); } });
  const master = ITEMS.every(i => sw[i.id]);

  const setOne = (id, v) => {
    const next = { ...sw, [id]: v };
    setSw(next);
    try { localStorage.setItem('it_notif_prefs', JSON.stringify({ items: next })); } catch(e) {}
  };
  const onMaster = (v) => {
    const next = {}; ITEMS.forEach(i => { next[i.id] = v; });
    setSw(next);
    try { localStorage.setItem('it_notif_prefs', JSON.stringify({ items: next })); } catch(e) {}
  };

  return (
    <div>
      <SectionTitle>Control</SectionTitle>
      <Row label="Activar todas" desc={`${ITEMS.filter(i => sw[i.id]).length} de ${ITEMS.length} activas`}>
        <Toggle checked={master} onChange={onMaster} />
      </Row>
      <SectionTitle>Por categoría</SectionTitle>
      {ITEMS.map(it => (
        <Row key={it.id} label={it.label} desc={it.desc}>
          <Toggle checked={!!sw[it.id]} onChange={v => setOne(it.id, v)} />
        </Row>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: ZONA DE RIESGO
// ══════════════════════════════════════════════════════════════════════════════
function TabRiesgo({ toast2, syncStateWithLocalStorage, onClose }) {
  const [deletePhrase, setDeletePhrase] = useState('');
  const [showConfirm,  setShowConfirm]  = useState(false);

  const doLogout = async () => {
    try { if (supabase) await supabase.auth.signOut(); } catch(e) {}
    try {
      Object.keys(localStorage).filter(k => k.startsWith('it_')).forEach(k => localStorage.removeItem(k));
    } catch(e) {}
    syncStateWithLocalStorage && syncStateWithLocalStorage();
    onClose && onClose();
    window.location.href = window.location.pathname || '/';
  };

  const doDelete = async () => {
    if (deletePhrase !== 'ELIMINAR') return;
    await doLogout();
  };

  const dangerRow = (label, desc, btnLabel, onClick, variant = 'outline') => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      padding: '14px 18px', background: C.card,
      border: '1px solid #4B1A1A', borderRadius: 10, marginBottom: 6,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.red }}>{label}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{desc}</div>
      </div>
      <button type="button" onClick={onClick} style={{
        background: variant === 'fill' ? C.red : 'transparent',
        border: `1px solid ${C.red}`, color: variant === 'fill' ? '#fff' : C.red,
        borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600,
        letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer',
        fontFamily: 'inherit', flexShrink: 0,
      }}>{btnLabel}</button>
    </div>
  );

  return (
    <div>
      <SectionTitle>Sesión</SectionTitle>
      {dangerRow('Cerrar sesión', 'Salir del dispositivo actual sin borrar datos', 'Cerrar sesión', doLogout)}

      <SectionTitle>Datos</SectionTitle>
      {dangerRow('Exportar mis datos', 'Descargá tus datos en JSON', 'Exportar', () => {
        try {
          const data = {};
          Object.keys(localStorage).filter(k => k.startsWith('it_')).forEach(k => { data[k] = localStorage.getItem(k); });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
          a.download = `irontrack-export-${Date.now()}.json`;
          a.click();
          toast2('Exportación lista ✓');
        } catch(e) { toast2('Error al exportar'); }
      })}

      <SectionTitle>Eliminación permanente</SectionTitle>
      {!showConfirm ? (
        dangerRow('Eliminar cuenta', 'Acción irreversible — borra todos tus datos', 'Eliminar cuenta', () => setShowConfirm(true))
      ) : (
        <div style={{ background: C.card, border: '1px solid #4B1A1A', borderRadius: 10, padding: '16px 18px', marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: '#FCA5A5', marginBottom: 12 }}>
            Escribí <strong>ELIMINAR</strong> para confirmar. Esta acción no se puede deshacer.
          </div>
          <input
            value={deletePhrase} onChange={e => setDeletePhrase(e.target.value)}
            placeholder="ELIMINAR"
            style={{
              width: '100%', background: C.bg, border: `1px solid ${C.red}`,
              borderRadius: 8, padding: '10px 14px', fontSize: 14,
              color: C.text, fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none',
              marginBottom: 12,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={doDelete} disabled={deletePhrase !== 'ELIMINAR'} style={{
              background: deletePhrase === 'ELIMINAR' ? C.red : '#4B1A1A',
              color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
              cursor: deletePhrase === 'ELIMINAR' ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}>ELIMINAR CUENTA</button>
            <button type="button" onClick={() => { setShowConfirm(false); setDeletePhrase(''); }} style={{
              background: 'transparent', border: `1px solid ${C.border}`, color: C.muted,
              borderRadius: 7, padding: '8px 18px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT: SettingsPage
// ══════════════════════════════════════════════════════════════════════════════
export default function SettingsPage({
  coach, onClose, toast2, setSessionData, syncStateWithLocalStorage,
  lang, setLang, darkMode, setDarkMode, es,
  alumnosCount, rutinasActivasCount, sesionesGlobales,
  sb, entrenadorId, initialSection = 'perfil',
}) {
  const [active, setActive] = useState(
    SECTIONS.some(s => s.id === initialSection) ? initialSection : 'perfil'
  );

  useEffect(() => {
    if (SECTIONS.some(s => s.id === initialSection)) setActive(initialSection);
  }, [initialSection]);

  const panelProps = {
    perfil:         { coach, setSessionData, toast2, entrenadorId },
    preferencias:   { lang, setLang, darkMode, setDarkMode, toast2 },
    negocio:        { toast2, alumnosCount },
    suscripcion:    { alumnosCount, rutinasActivasCount },
    notificaciones: {},
    riesgo:         { toast2, syncStateWithLocalStorage, onClose },
  };

  const TABS = { perfil: TabPerfil, preferencias: TabPreferencias, negocio: TabNegocio, suscripcion: TabSuscripcion, notificaciones: TabNotificaciones, riesgo: TabRiesgo };
  const ActiveTab = TABS[active] || TabPerfil;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 220,
      display: 'flex', flexDirection: 'column',
      background: C.bg, color: C.text,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* HEADER */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 52, flexShrink: 0,
        borderBottom: `1px solid ${C.border}`, background: '#0D1117',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: C.muted }}>Configuración</div>
          <div style={{ fontSize: 20, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2, lineHeight: 1.1 }}>MODO ENTRENADOR</div>
        </div>
        <button type="button" onClick={onClose} style={{
          background: 'transparent', border: `1px solid ${C.border}`, color: C.muted,
          borderRadius: 7, padding: '5px 14px', fontSize: 12, fontWeight: 600,
          letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit',
        }}>CERRAR</button>
      </div>

      {/* BODY */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* SIDEBAR */}
        <aside style={{
          width: 200, flexShrink: 0,
          borderRight: `1px solid ${C.border}`,
          background: '#0D1117',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', padding: '16px 10px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: C.muted, padding: '4px 8px 10px' }}>Navegación</div>
          {SECTIONS.map((s, i) => {
            const isActive = active === s.id;
            return (
              <React.Fragment key={s.id}>
                {s.danger && i > 0 && <div style={{ height: 1, background: C.border, margin: '8px 0' }} />}
                <button
                  type="button"
                  onClick={() => setActive(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '9px 10px', borderRadius: 8,
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                    background: isActive ? (s.danger ? 'rgba(239,68,68,.15)' : '#1D2D50') : 'transparent',
                    color: isActive ? (s.danger ? C.red : C.blueL) : (s.danger ? '#FCA5A5' : C.sub),
                    borderLeft: isActive ? `3px solid ${s.danger ? C.red : C.blueL}` : '3px solid transparent',
                    transition: 'all .15s',
                  }}
                >{s.label}</button>
              </React.Fragment>
            );
          })}
        </aside>

        {/* CONTENT */}
        <main style={{
          flex: 1, overflowY: 'auto', padding: '24px 28px',
          background: C.bg,
        }}>
          <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 22, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2 }}>
              {SECTIONS.find(s => s.id === active)?.label?.toUpperCase()}
            </div>
          </div>
          <ActiveTab key={active} {...(panelProps[active] || {})} />
        </main>
      </div>
    </div>
  );
}

/** Sincroniza atributos en `document.documentElement` con `it_prefs` (bootstrap en App.jsx). */
export function applyItPrefsToDocument(p) {
  if (!p || typeof p !== 'object') return;
  const root = document.documentElement;
  if (p.lang) root.setAttribute('data-it-lang', p.lang);
  if (p.theme) root.setAttribute('data-it-theme', p.theme);
  if (p.tz) root.setAttribute('data-it-tz', p.tz);
}
