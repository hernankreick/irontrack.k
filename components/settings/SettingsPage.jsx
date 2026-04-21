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

const SUPPORTED_LANGS = ['es', 'en', 'pt'];

/** Locale BCP 47 para fechas según idioma de la app. */
function localeForSettingsDates(lang) {
  if (lang === 'pt') return 'pt-BR';
  if (lang === 'en') return 'en-US';
  return 'es-AR';
}

/** Textos de la pantalla de configuración coach según idioma (es / en / pt). */
function coachUiStrings(lang) {
  const es = lang === 'es';
  const pt = lang === 'pt';
  return {
    settingsHeader: es ? 'Configuración' : pt ? 'Configuração' : 'Settings',
    coachMode: es ? 'MODO ENTRENADOR' : pt ? 'MODO TREINADOR' : 'COACH MODE',
    close: es ? 'CERRAR' : pt ? 'FECHAR' : 'CLOSE',
    navigation: es ? 'Navegación' : pt ? 'Navegação' : 'Navigation',
    sectionLabels: {
      perfil: es ? 'Perfil' : pt ? 'Perfil' : 'Profile',
      preferencias: es ? 'Preferencias' : pt ? 'Preferências' : 'Preferences',
      negocio: es ? 'Negocio' : pt ? 'Negócio' : 'Business',
      suscripcion: es ? 'Suscripción' : pt ? 'Assinatura' : 'Subscription',
      notificaciones: es ? 'Notificaciones' : pt ? 'Notificações' : 'Notifications',
      riesgo: es ? 'Zona de riesgo' : pt ? 'Zona de perigo' : 'Danger zone',
    },
    prefs: {
      appearance: es ? 'Apariencia' : pt ? 'Aparência' : 'Appearance',
      language: es ? 'Idioma' : pt ? 'Idioma' : 'Language',
      languageDesc: es ? 'Afecta textos de la app donde aplique' : pt ? 'Afeta os textos do app quando aplicável' : 'Affects in-app text where available',
      langEs: es ? 'ES Español' : pt ? 'ES Espanhol' : 'ES Spanish',
      langEn: es ? 'EN Inglés' : pt ? 'EN Inglês' : 'EN English',
      langPt: es ? 'PT Portugués' : pt ? 'PT Português' : 'PT Portuguese',
      theme: es ? 'Tema' : pt ? 'Tema' : 'Theme',
      themeDesc: es ? 'Claro, oscuro o siguiendo al sistema' : pt ? 'Claro, escuro ou seguindo o sistema' : 'Light, dark, or match system',
      night: es ? 'Noche' : pt ? 'Noite' : 'Night',
      day: es ? 'Día' : pt ? 'Dia' : 'Day',
      system: es ? 'Sistema' : pt ? 'Sistema' : 'System',
      behavior: es ? 'Comportamiento' : pt ? 'Comportamento' : 'Behavior',
      timezone: es ? 'Zona horaria' : pt ? 'Fuso horário' : 'Time zone',
      timezoneDesc: es ? 'Referencia para calendarios y recordatorios' : pt ? 'Referência para calendários e lembretes' : 'Reference for calendars and reminders',
      timezones: [
        { id: 'America/Argentina/Buenos_Aires', label: es ? 'Buenos Aires (ART)' : pt ? 'Buenos Aires (ART)' : 'Buenos Aires (ART)' },
        { id: 'America/Santiago', label: es ? 'Santiago (CLT)' : pt ? 'Santiago (CLT)' : 'Santiago (CLT)' },
        { id: 'America/Lima', label: es ? 'Lima (PET)' : pt ? 'Lima (PET)' : 'Lima (PET)' },
        { id: 'America/Bogota', label: es ? 'Bogotá (COT)' : pt ? 'Bogotá (COT)' : 'Bogotá (COT)' },
        { id: 'America/Mexico_City', label: es ? 'Ciudad de México (CST)' : pt ? 'Cidade do México (CST)' : 'Mexico City (CST)' },
        { id: 'Europe/Madrid', label: es ? 'Madrid (CET)' : pt ? 'Madrid (CET)' : 'Madrid (CET)' },
      ],
      saved: es ? 'Guardado ✓' : pt ? 'Salvo ✓' : 'Saved ✓',
      save: es ? 'GUARDAR' : pt ? 'SALVAR' : 'SAVE',
      savedBtn: es ? 'GUARDADO ✓' : pt ? 'SALVO ✓' : 'SAVED ✓',
      toastSaved: es ? 'Preferencias guardadas ✓' : pt ? 'Preferências salvas ✓' : 'Preferences saved ✓',
    },
    perfil: {
      proActive: es ? 'Pro Activo' : pt ? 'Pro Ativo' : 'Pro Active',
      personal: es ? 'Datos personales' : pt ? 'Dados pessoais' : 'Personal details',
      fullName: es ? 'Nombre completo' : pt ? 'Nome completo' : 'Full name',
      fullNamePh: es ? 'Nombre y apellido' : pt ? 'Nome e sobrenome' : 'First and last name',
      professionalTitle: es ? 'Título profesional' : pt ? 'Título profissional' : 'Professional title',
      professionalTitlePh: es ? 'Ej: Entrenador · Fuerza' : pt ? 'Ex.: Treinador · Força' : 'e.g. Coach · Strength',
      email: es ? 'Email' : pt ? 'E-mail' : 'Email',
      emailPh: es ? 'correo@ejemplo.com' : pt ? 'email@exemplo.com' : 'you@example.com',
      phone: es ? 'Teléfono' : pt ? 'Telefone' : 'Phone',
      phonePh: es ? '+54 9 11 ...' : pt ? '+55 ...' : '+1 ...',
      password: es ? 'Contraseña' : pt ? 'Senha' : 'Password',
      newPassword: es ? 'Nueva contraseña' : pt ? 'Nova senha' : 'New password',
      newPasswordPh: es ? 'Mínimo 6 caracteres' : pt ? 'Mínimo 6 caracteres' : 'At least 6 characters',
      confirmPassword: es ? 'Confirmar contraseña' : pt ? 'Confirmar senha' : 'Confirm password',
      confirmPasswordPh: es ? 'Repetí la nueva' : pt ? 'Repita a nova senha' : 'Repeat new password',
      errPassword: es ? 'Error al cambiar contraseña' : pt ? 'Erro ao alterar senha' : 'Could not change password',
      passwordOk: es ? 'Contraseña actualizada ✓' : pt ? 'Senha atualizada ✓' : 'Password updated ✓',
      passwordsMismatch: es ? 'Las contraseñas no coinciden' : pt ? 'As senhas não coincidem' : 'Passwords do not match',
      profileSaved: es ? 'Perfil guardado ✓' : pt ? 'Perfil salvo ✓' : 'Profile saved ✓',
      saveLabel: es ? 'GUARDAR' : pt ? 'SALVAR' : 'SAVE',
      saveHint: es ? 'Guardado ✓' : pt ? 'Salvo ✓' : 'Saved ✓',
      saveDone: es ? 'GUARDADO ✓' : pt ? 'SALVO ✓' : 'SAVED ✓',
    },
    negocio: {
      identity: es ? 'Identidad' : pt ? 'Identidade' : 'Identity',
      gymName: es ? 'Nombre del gimnasio / marca' : pt ? 'Nome da academia / marca' : 'Gym / brand name',
      gymNamePh: 'Iron Track Gym',
      commercialPhone: es ? 'Teléfono comercial' : pt ? 'Telefone comercial' : 'Business phone',
      commercialPhonePh: es ? '+54 ...' : pt ? '+55 ...' : '+1 ...',
      operation: es ? 'Operación' : pt ? 'Operação' : 'Operations',
      maxCapacity: es ? 'Capacidad máxima de alumnos' : pt ? 'Capacidade máxima de alunos' : 'Max athletes capacity',
      free: es ? 'Libres' : pt ? 'Livres' : 'Free',
      current: es ? 'Actuales' : pt ? 'Atuais' : 'Current',
      currency: es ? 'Moneda' : pt ? 'Moeda' : 'Currency',
      currencyDesc: es ? 'Para montos y reportes' : pt ? 'Para valores e relatórios' : 'For amounts and reports',
      saved: es ? 'Negocio guardado ✓' : pt ? 'Negócio salvo ✓' : 'Business settings saved ✓',
      saveLabel: es ? 'GUARDAR' : pt ? 'SALVAR' : 'SAVE',
      saveHint: es ? 'Guardado ✓' : pt ? 'Salvo ✓' : 'Saved ✓',
      saveDone: es ? 'GUARDADO ✓' : pt ? 'SALVO ✓' : 'SAVED ✓',
    },
    suscripcion: {
      currentPlan: es ? 'Plan actual' : pt ? 'Plano atual' : 'Current plan',
      active: es ? 'ACTIVO' : pt ? 'ATIVO' : 'ACTIVE',
      perMonth: es ? '/ mes' : pt ? '/ mês' : '/ month',
      nextRenewal: es ? 'Próxima renovación' : pt ? 'Próxima renovação' : 'Next renewal',
      planUsage: es ? 'Uso del plan' : pt ? 'Uso do plano' : 'Plan usage',
      athletes: es ? 'Alumnos' : pt ? 'Alunos' : 'Athletes',
      activeRoutines: es ? 'Rutinas activas' : pt ? 'Rotinas ativas' : 'Active routines',
      billing: es ? 'Facturación' : pt ? 'Faturamento' : 'Billing',
      paymentMethod: es ? 'Método de pago' : pt ? 'Método de pagamento' : 'Payment method',
      paymentMethodDesc: es ? 'Visa •••• 4242 — expira 08/27' : pt ? 'Visa •••• 4242 — expira 08/27' : 'Visa •••• 4242 — exp. 08/27',
      update: es ? 'Actualizar' : pt ? 'Atualizar' : 'Update',
    },
    notificaciones: {
      control: es ? 'Control' : pt ? 'Controle' : 'Control',
      activateAll: es ? 'Activar todas' : pt ? 'Ativar todas' : 'Enable all',
      activateAllDesc: (n, total) =>
        es ? `${n} de ${total} activas` : pt ? `${n} de ${total} ativas` : `${n} of ${total} on`,
      byCategory: es ? 'Por categoría' : pt ? 'Por categoria' : 'By category',
      items: [
        { id: 'alumno', label: es ? 'Nuevos alumnos' : pt ? 'Novos alunos' : 'New athletes', desc: es ? 'Alta o aceptación de invitación' : pt ? 'Cadastro ou aceite de convite' : 'Signup or invite accepted' },
        { id: 'mensaje', label: es ? 'Mensajes' : pt ? 'Mensagens' : 'Messages', desc: es ? 'Mensajes nuevos en el chat' : pt ? 'Novas mensagens no chat' : 'New chat messages' },
        { id: 'sesion', label: es ? 'Sesiones completadas' : pt ? 'Sessões concluídas' : 'Completed sessions', desc: es ? 'Cuando un alumno finaliza entreno' : pt ? 'Quando um aluno termina o treino' : 'When an athlete finishes a workout' },
        { id: 'rutina', label: es ? 'Cambios en rutinas' : pt ? 'Alterações em rotinas' : 'Routine changes', desc: es ? 'Rutinas asignadas o completadas' : pt ? 'Rotinas atribuídas ou concluídas' : 'Routines assigned or completed' },
        { id: 'pago', label: es ? 'Pagos y vencimientos' : pt ? 'Pagamentos e vencimentos' : 'Payments & due dates', desc: es ? 'Recordatorios de cuotas' : pt ? 'Lembretes de mensalidades' : 'Fee reminders' },
        { id: 'sistema', label: es ? 'Sistema' : pt ? 'Sistema' : 'System', desc: es ? 'Actualizaciones de la plataforma' : pt ? 'Atualizações da plataforma' : 'Platform updates' },
      ],
    },
    riesgo: {
      session: es ? 'Sesión' : pt ? 'Sessão' : 'Session',
      logOut: es ? 'Cerrar sesión' : pt ? 'Sair' : 'Log out',
      logOutDesc: es ? 'Salir del dispositivo actual sin borrar datos' : pt ? 'Sair deste dispositivo sem apagar dados' : 'Sign out on this device without erasing data',
      data: es ? 'Datos' : pt ? 'Dados' : 'Data',
      exportData: es ? 'Exportar mis datos' : pt ? 'Exportar meus dados' : 'Export my data',
      exportDataDesc: es ? 'Descargá tus datos en JSON' : pt ? 'Baixe seus dados em JSON' : 'Download your data as JSON',
      export: es ? 'Exportar' : pt ? 'Exportar' : 'Export',
      exportOk: es ? 'Exportación lista ✓' : pt ? 'Exportação pronta ✓' : 'Export ready ✓',
      exportErr: es ? 'Error al exportar' : pt ? 'Erro ao exportar' : 'Export failed',
      permanentDeletion: es ? 'Eliminación permanente' : pt ? 'Exclusão permanente' : 'Permanent deletion',
      deleteAccount: es ? 'Eliminar cuenta' : pt ? 'Excluir conta' : 'Delete account',
      deleteAccountDesc: es ? 'Acción irreversible — borra todos tus datos' : pt ? 'Ação irreversível — apaga todos os seus dados' : 'Irreversible — deletes all your data',
      deleteAccountBtn: es ? 'Eliminar cuenta' : pt ? 'Excluir conta' : 'Delete account',
      deleteWord: es ? 'ELIMINAR' : pt ? 'EXCLUIR' : 'DELETE',
      deleteAccountFinal: es ? 'ELIMINAR CUENTA' : pt ? 'EXCLUIR CONTA' : 'DELETE ACCOUNT',
      confirmHtml: es
        ? ['Escribí ', ' para confirmar. Esta acción no se puede deshacer.']
        : pt
          ? ['Digite ', ' para confirmar. Esta ação não pode ser desfeita.']
          : ['Type ', ' to confirm. This action cannot be undone.'],
      cancel: es ? 'Cancelar' : pt ? 'Cancelar' : 'Cancel',
    },
  };
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

function SaveBtn({ onClick, saved, savedHint, saveLabel, savedLabel }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 10, alignItems: 'center' }}>
      {saved && <span style={{ fontSize: 12, color: C.green }}>{savedHint ?? 'Saved ✓'}</span>}
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
      >{saved ? (savedLabel ?? 'SAVED ✓') : (saveLabel ?? 'SAVE')}</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCIÓN: PERFIL
// ══════════════════════════════════════════════════════════════════════════════
function TabPerfil({ coach, setSessionData, toast2, entrenadorId, t }) {
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
      if (error) toast2(t.errPassword);
      else { toast2(t.passwordOk); setPassNew(''); setPassConf(''); }
    } else if (passNew && passNew !== passConf) {
      toast2(t.passwordsMismatch); return;
    }
    setSaved(true); setTimeout(() => setSaved(false), 2200);
    toast2(t.profileSaved);
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
          }}>{t.proActive}</div>
        </div>
      </div>

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
    else                  { setDarkMode(false); try { localStorage.setItem('it_dark','false'); } catch(e) {} }
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
          value={tema} onChange={setTema}
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
              background: moneda === m ? '#1D2D50' : 'transparent',
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
  const renewal = new Date(new Date().setMonth(new Date().getMonth() + 1))
    .toLocaleDateString(localeForSettingsDates(lang || 'es'), { day: 'numeric', month: 'short', year: 'numeric' });

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
      <SectionTitle>{t.currentPlan}</SectionTitle>
      <div style={{
        background: 'linear-gradient(135deg, #1D2D50 0%, #0F1829 100%)',
        border: `1px solid ${C.blue}`, borderRadius: 14, padding: '20px 22px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', background: C.blue, color: '#fff', display: 'inline-flex', padding: '2px 10px', borderRadius: 20, marginBottom: 10 }}>{t.active}</div>
        <div style={{ fontSize: 24, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2, color: C.text }}>IRONTRACK PRO</div>
        <div style={{ fontSize: 28, fontFamily: 'DM Mono, monospace', color: C.blueL, marginTop: 4 }}>$29 <span style={{ fontSize: 13, color: C.muted }}>{t.perMonth}</span></div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>{t.nextRenewal}: {renewal}</div>
      </div>

      <SectionTitle>{t.planUsage}</SectionTitle>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px', marginBottom: 6 }}>
        <Bar label={t.athletes} current={alumnosCount || 0} max={50} color={C.blue} />
        <Bar label={t.activeRoutines} current={rutinasActivasCount || 0} max={40} color={C.blueL} />
      </div>

      <SectionTitle>{t.billing}</SectionTitle>
      <Row label={t.paymentMethod} desc={t.paymentMethodDesc}>
        <button type="button" style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 14px', fontSize: 12, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>{t.update}</button>
      </Row>
    </div>
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
        <div style={{ background: C.card, border: '1px solid #4B1A1A', borderRadius: 10, padding: '16px 18px', marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: '#FCA5A5', marginBottom: 12 }}>
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
              background: deletePhrase === t.deleteWord ? C.red : '#4B1A1A',
              color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px',
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

  return (
    <div style={embed ? {
      position: 'relative',
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      overflow: 'hidden',
      background: C.bg,
      color: C.text,
      fontFamily: "'DM Sans', sans-serif",
      borderRadius: 12,
      boxSizing: 'border-box',
    } : {
      position: 'fixed', inset: 0, zIndex: 220,
      display: 'flex', flexDirection: 'column',
      background: C.bg, color: C.text,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* HEADER — en embed el padding horizontal lo aplica el contenedor padre (misma columna que Alumnos/Rutinas) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: embed ? '12px 0' : '0 24px',
        minHeight: 52,
        height: embed ? undefined : 52,
        flexShrink: 0,
        borderBottom: `1px solid ${C.border}`, background: '#0D1117',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: C.muted }}>{ui.settingsHeader}</div>
          <div style={{ fontSize: 20, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2, lineHeight: 1.1 }}>{ui.coachMode}</div>
        </div>
        <button type="button" onClick={onClose} style={{
          background: 'transparent', border: `1px solid ${C.border}`, color: C.muted,
          borderRadius: 7, padding: '5px 14px', fontSize: 12, fontWeight: 600,
          letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit',
        }}>{ui.close}</button>
      </div>

      {/* BODY */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* SIDEBAR */}
        <aside style={{
          width: 200, flexShrink: 0,
          borderRight: `1px solid ${C.border}`,
          background: '#0D1117',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          padding: embed ? '16px 8px 16px 0' : '16px 10px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: C.muted, padding: embed ? '4px 0 10px' : '4px 8px 10px' }}>{ui.navigation}</div>
          {sections.map((s, i) => {
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
          flex: 1,
          overflowY: 'auto',
          padding: embed ? '24px 0 24px 20px' : '24px 28px',
          background: C.bg,
          boxSizing: 'border-box',
        }}>
          <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 22, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2 }}>
              {sections.find(s => s.id === active)?.label?.toUpperCase()}
            </div>
          </div>
          <ActiveTab key={active} {...(panelProps[active] || {})} />
        </main>
      </div>
    </div>
  );
}
