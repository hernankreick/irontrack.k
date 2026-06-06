import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import coachSettingsPalette from './coachSettingsPalette.js';
import coachUiStrings from './coachUiStrings.js';
import {
  BtnGroup,
  Input,
  Row,
  SaveBtn,
  SectionTitle,
  SettingsPaletteContext,
  Toggle,
  useSettingsPalette,
} from './SettingsFormControls.jsx';
import SettingsProfileSummaryCard from './SettingsProfileSummaryCard.jsx';
import SettingsShell from './SettingsShell.jsx';
import SettingsSubscriptionTab from './SettingsSubscriptionTab.jsx';

const SUPPORTED_LANGS = ['es', 'en', 'pt'];

/** Locale BCP 47 para fechas según idioma de la app. */
function localeForSettingsDates(lang) {
  if (lang === 'pt') return 'pt-BR';
  if (lang === 'en') return 'en-US';
  return 'es-AR';
}

function buildSections(ui) {
  const L = ui.sectionLabels;
  return [
    { id: 'perfil',         label: L.perfil,         danger: false },
    { id: 'preferencias',   label: L.preferencias,   danger: false },
    { id: 'negocio',        label: L.negocio,        danger: false },
    { id: 'suscripcion',    label: L.suscripcion,    danger: false },
    { id: 'notificaciones', label: L.notificaciones, danger: false },
    { id: 'riesgo',         label: L.riesgo,         danger: true  },
  ];
}

/** Sincroniza atributos en `document.documentElement` con `it_prefs` (bootstrap en App.jsx). */
export function applyItPrefsToDocument(p) {
  if (!p || typeof p !== 'object') return;
  const root = document.documentElement;
  if (p.lang) root.setAttribute('data-it-lang', p.lang);
  if (p.theme) root.setAttribute('data-it-theme', p.theme);
  if (p.tz) root.setAttribute('data-it-tz', p.tz);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function initials(name) {
  const p = (name || 'CO').trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return 'CO';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: PERFIL
// ══════════════════════════════════════════════════════════════════════════════
function TabPerfil({ coach, setSessionData, toast2, entrenadorId, t }) {
  const C = useSettingsPalette();
  const [fullName, setFullName] = useState(coach?.name || '');
  const [titulo,   setTitulo]   = useState(coach?.titulo || '');
  const [email,    setEmail]    = useState(coach?.email || '');
  const [phone,    setPhone]    = useState(coach?.phone || '');
  const [passNew,  setPassNew]  = useState('');
  const [passConf, setPassConf] = useState('');
  const [saved,    setSaved]    = useState(false);

  const onSave = async () => {
    const next = { ...coach, name: fullName.trim(), titulo: titulo.trim(), email: email.trim(), phone: phone.trim() };
    try { localStorage.setItem('it_session', JSON.stringify(next)); } catch (e) {}
    try {
      localStorage.setItem(
        'it_coach_profile_local',
        JSON.stringify({ name: fullName.trim(), titulo: titulo.trim() })
      );
    } catch (e) {}
    setSessionData(next);
    if (supabase) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData && userData.user && userData.user.id;
        if (uid) {
          const { error: rowErr } = await supabase
            .from('entrenadores')
            .update({
              nombre: fullName.trim() || null,
              titulo_profesional: titulo.trim() || null,
              telefono: phone.trim() || null,
            })
            .eq('id', uid);
          if (rowErr) {
            console.error('[TabPerfil] entrenadores update', rowErr);
          }
        }
      } catch (e) {
        console.error('[TabPerfil] supabase', e);
      }
    }
    if (passNew && passNew === passConf && passNew.length >= 6 && supabase) {
      const { error } = await supabase.auth.updateUser({ password: passNew });
      if (error) toast2(t.errPassword);
      else { toast2(t.passwordOk); setPassNew(''); setPassConf(''); }
    } else if (passNew && passNew !== passConf) {
      toast2(t.passwordsMismatch);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
    toast2(t.profileSaved);
  };

  return (
    <div>
      <SettingsProfileSummaryCard
        C={C}
        initialsText={initials(fullName || coach?.name)}
        displayName={fullName || coach?.name}
        email={email || coach?.email}
        proActiveLabel={t.proActive}
      />

      <SectionTitle>{t.personal}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Input label={t.fullName} value={fullName} onChange={setFullName} placeholder={t.fullNamePh} />
        <Input label={t.professionalTitle} value={titulo} onChange={setTitulo} placeholder={t.professionalTitlePh} />
        <Input label={t.email} value={email} onChange={setEmail} type="email" placeholder={t.emailPh} />
        <Input label={t.phone} value={phone} onChange={setPhone} type="tel" placeholder={t.phonePh} />
      </div>

      <SectionTitle>{t.password}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Input label={t.newPassword} value={passNew} onChange={setPassNew} type="password" placeholder={t.newPasswordPh} />
        <Input label={t.confirmPassword} value={passConf} onChange={setPassConf} type="password" placeholder={t.confirmPasswordPh} />
      </div>

      <SaveBtn onClick={onSave} saved={saved} saveLabel={t.saveLabel} savedHint={t.saveHint} savedLabel={t.saveDone} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: PREFERENCIAS
// ══════════════════════════════════════════════════════════════════════════════
function TabPreferencias({ lang, setLang, darkMode, setDarkMode, toast2 }) {
  const C = useSettingsPalette();
  const P = coachUiStrings(lang).prefs;
  const [locale, setLocale] = useState(() => (SUPPORTED_LANGS.includes(lang) ? lang : 'es'));
  const [tema,   setTema]   = useState(darkMode ? 'night' : 'day');
  const [tz,     setTz]     = useState('America/Argentina/Buenos_Aires');
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    if (SUPPORTED_LANGS.includes(lang)) setLocale(lang);
  }, [lang]);

  /** Mismo comportamiento que modo alumno: el idioma aplica al instante y persiste. */
  const onLocaleChange = (next) => {
    setLocale(next);
    try { localStorage.setItem('it_lang', next); } catch(e) {}
    setLang(next);
    try { applyItPrefsToDocument({ lang: next }); } catch(e) {}
  };

  const onSave = () => {
    try { localStorage.setItem('it_lang', locale); } catch(e) {}
    setLang(locale);
    try { applyItPrefsToDocument({ lang: locale }); } catch(e) {}
    if (tema === 'night') { setDarkMode(true); try { localStorage.setItem('it_dark','true'); } catch(e) {} }
    else if (tema === 'day') { setDarkMode(false); try { localStorage.setItem('it_dark','false'); } catch(e) {} }
    else {
      var sysDark = false;
      try { sysDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e2) {}
      setDarkMode(sysDark);
      try { localStorage.setItem('it_dark', sysDark ? 'true' : 'false'); } catch(e3) {}
    }
    setSaved(true); setTimeout(() => setSaved(false), 2200);
    toast2(P.toastSaved);
  };

  return (
    <div>
      <SectionTitle>{P.appearance}</SectionTitle>
      <Row label={P.language} desc={P.languageDesc}>
        <BtnGroup
          options={[{ id: 'es', label: P.langEs }, { id: 'en', label: P.langEn }, { id: 'pt', label: P.langPt }]}
          value={locale} onChange={onLocaleChange}
        />
      </Row>
      <Row label={P.theme} desc={P.themeDesc}>
        <BtnGroup
          options={[{id:'night',label:P.night},{id:'day',label:P.day},{id:'system',label:P.system}]}
          value={tema}
          onChange={(next) => {
            setTema(next);
            if (next === 'night') { setDarkMode(true); try { localStorage.setItem('it_dark', 'true'); } catch (e) {} }
            else if (next === 'day') { setDarkMode(false); try { localStorage.setItem('it_dark', 'false'); } catch (e) {} }
            else {
              var m = false;
              try { m = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e2) {}
              setDarkMode(m);
              try { localStorage.setItem('it_dark', m ? 'true' : 'false'); } catch (e3) {}
            }
          }}
        />
      </Row>

      <SectionTitle>{P.behavior}</SectionTitle>
      <Row label={P.timezone} desc={P.timezoneDesc}>
        <select
          value={tz} onChange={e => setTz(e.target.value)}
          style={{
            background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '8px 12px', fontSize: 13,
            color: C.text, fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          {P.timezones.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </Row>
      <SaveBtn onClick={onSave} saved={saved} savedHint={P.saved} saveLabel={P.save} savedLabel={P.savedBtn} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: NEGOCIO
// ══════════════════════════════════════════════════════════════════════════════
function TabNegocio({ toast2, alumnosCount, t }) {
  const C = useSettingsPalette();
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
    toast2(t.saved);
  };

  const cupos = Math.max(0, capMax - (alumnosCount || 0));

  return (
    <div>
      <SectionTitle>{t.identity}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Input label={t.gymName} value={nombre} onChange={setNombre} placeholder={t.gymNamePh} />
        <Input label={t.commercialPhone} value={tel} onChange={setTel} placeholder={t.commercialPhonePh} />
      </div>

      <SectionTitle>{t.operation}</SectionTitle>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px', marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{t.maxCapacity}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.text, fontFamily: 'DM Mono, monospace' }}>{capMax}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          {t.free}: <span style={{ color: C.green, fontWeight: 600 }}>{cupos}</span>
          {' · '}{t.current}: <span style={{ color: C.sub }}>{alumnosCount || 0}</span>
        </div>
        <input type="range" min={1} max={100} value={capMax} onChange={e => setCapMax(Number(e.target.value))}
          style={{ width: '100%', marginTop: 12, accentColor: C.blue }} />
      </div>

      <Row label={t.currency} desc={t.currencyDesc}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {MONEDAS.map(m => (
            <button key={m} type="button" onClick={() => setMoneda(m)} style={{
              padding: '5px 12px', borderRadius: 7, border: `1px solid ${moneda === m ? C.blue : C.border}`,
              background: moneda === m ? C.currencySelBg : 'transparent',
              color: moneda === m ? C.blueL : C.muted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>{m}</button>
          ))}
        </div>
      </Row>
      <SaveBtn onClick={onSave} saved={saved} saveLabel={t.saveLabel} savedHint={t.saveHint} savedLabel={t.saveDone} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: SUSCRIPCIÓN
// ══════════════════════════════════════════════════════════════════════════════
function TabSuscripcion({ alumnosCount, rutinasActivasCount, t, lang }) {
  const C = useSettingsPalette();
  const renewal = new Date(new Date().setMonth(new Date().getMonth() + 1))
    .toLocaleDateString(localeForSettingsDates(lang || 'es'), { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <SettingsSubscriptionTab
      C={C}
      t={t}
      renewal={renewal}
      alumnosCount={alumnosCount}
      rutinasActivasCount={rutinasActivasCount}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: NOTIFICACIONES
// ══════════════════════════════════════════════════════════════════════════════
function TabNotificaciones({ t }) {
  const ITEMS = t.items;
  const init = () => { const o = {}; ITEMS.forEach(i => { o[i.id] = true; }); return o; };
  const [sw, setSw] = useState(() => { try { const r = localStorage.getItem('it_notif_prefs'); return r ? { ...init(), ...JSON.parse(r).items } : init(); } catch(e) { return init(); } });
  const master = ITEMS.every(i => sw[i.id]);
  const onCount = ITEMS.filter(i => sw[i.id]).length;

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
      <SectionTitle>{t.control}</SectionTitle>
      <Row label={t.activateAll} desc={t.activateAllDesc(onCount, ITEMS.length)}>
        <Toggle checked={master} onChange={onMaster} />
      </Row>
      <SectionTitle>{t.byCategory}</SectionTitle>
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
function TabRiesgo({ toast2, syncStateWithLocalStorage, onClose, t }) {
  const C = useSettingsPalette();
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
    if (deletePhrase !== t.deleteWord) return;
    await doLogout();
  };

  const dangerRow = (label, desc, btnLabel, onClick, variant = 'outline') => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      padding: '14px 18px', background: C.card,
      border: `1px solid ${C.dangerCardBorder}`, borderRadius: 10, marginBottom: 6,
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
      <SectionTitle>{t.session}</SectionTitle>
      {dangerRow(t.logOut, t.logOutDesc, t.logOut, doLogout)}

      <SectionTitle>{t.data}</SectionTitle>
      {dangerRow(t.exportData, t.exportDataDesc, t.export, () => {
        try {
          const data = {};
          Object.keys(localStorage).filter(k => k.startsWith('it_')).forEach(k => { data[k] = localStorage.getItem(k); });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
          a.download = `irontrack-export-${Date.now()}.json`;
          a.click();
          toast2(t.exportOk);
        } catch(e) { toast2(t.exportErr); }
      })}

      <SectionTitle>{t.permanentDeletion}</SectionTitle>
      {!showConfirm ? (
        dangerRow(t.deleteAccount, t.deleteAccountDesc, t.deleteAccountBtn, () => setShowConfirm(true))
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.dangerCardBorder}`, borderRadius: 10, padding: '16px 18px', marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: C.deleteWarnText, marginBottom: 12 }}>
            {t.confirmHtml[0]}<strong>{t.deleteWord}</strong>{t.confirmHtml[1]}
          </div>
          <input
            value={deletePhrase} onChange={e => setDeletePhrase(e.target.value)}
            placeholder={t.deleteWord}
            style={{
              width: '100%', background: C.bg, border: `1px solid ${C.red}`,
              borderRadius: 8, padding: '10px 14px', fontSize: 14,
              color: C.text, fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none',
              marginBottom: 12,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={doDelete} disabled={deletePhrase !== t.deleteWord} style={{
              background: deletePhrase === t.deleteWord ? C.red : C.deleteDisabledBg,
              color: deletePhrase === t.deleteWord ? '#fff' : C.deleteBtnDisabledFg, border: 'none', borderRadius: 7, padding: '8px 18px',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
              cursor: deletePhrase === t.deleteWord ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}>{t.deleteAccountFinal}</button>
            <button type="button" onClick={() => { setShowConfirm(false); setDeletePhrase(''); }} style={{
              background: 'transparent', border: `1px solid ${C.border}`, color: C.muted,
              borderRadius: 7, padding: '8px 18px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>{t.cancel}</button>
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
  /** Coach (tab settings/perfil): flujo en columna con el mismo gutter que Dashboard/Alumnos (px-4 sm:px-5 lg:px-6). Si false, overlay pantalla completa. */
  embedInMainColumn = false,
}) {
  const ui = coachUiStrings(lang || 'es');
  const sections = buildSections(ui);

  const [active, setActive] = useState(
    sections.some(s => s.id === initialSection) ? initialSection : 'perfil'
  );

  // Solo cuando cambia `initialSection` (p. ej. barra Config vs Perfil). No depender de `lang`:
  // si no, al cambiar idioma se hace setActive(initialSection) y, con tab "perfil", vuelve a Perfil
  // aunque el usuario estuviera en Preferencias u otra sección.
  useEffect(() => {
    if (buildSections(coachUiStrings('es')).some((s) => s.id === initialSection)) setActive(initialSection);
  }, [initialSection]);

  const panelProps = {
    perfil:         { coach, setSessionData, toast2, entrenadorId, t: ui.perfil },
    preferencias:   { lang, setLang, darkMode, setDarkMode, toast2 },
    negocio:        { toast2, alumnosCount, t: ui.negocio },
    suscripcion:    { alumnosCount, rutinasActivasCount, t: ui.suscripcion, lang: lang || 'es' },
    notificaciones: { t: ui.notificaciones },
    riesgo:         { toast2, syncStateWithLocalStorage, onClose, t: ui.riesgo },
  };

  const TABS = { perfil: TabPerfil, preferencias: TabPreferencias, negocio: TabNegocio, suscripcion: TabSuscripcion, notificaciones: TabNotificaciones, riesgo: TabRiesgo };
  const ActiveTab = TABS[active] || TabPerfil;

  const embed = embedInMainColumn;
  const pal = useMemo(() => coachSettingsPalette(darkMode), [darkMode]);

  return (
    <SettingsPaletteContext.Provider value={pal}>
      <SettingsShell
        embed={embed}
        pal={pal}
        ui={ui}
        sections={sections}
        active={active}
        setActive={setActive}
        ActiveTab={ActiveTab}
        panelProps={panelProps}
        onClose={onClose}
      />
    </SettingsPaletteContext.Provider>
  );
}
