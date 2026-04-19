import React, { useRef, useState, useEffect } from 'react';
import SectionCard from './ui/SectionCard.jsx';
import Field from './ui/Field.jsx';
import Btn from './ui/Btn.jsx';
import StickyActionBar from './ui/StickyActionBar.jsx';
import { supabase } from '../../lib/supabaseClient.js';

function initials(name) {
  const p = (name || 'CO').trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return 'CO';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export default function SectionPerfil({ coach, setSessionData, toast2, sb, entrenadorId }) {
  const fileRef = useRef(null);
  const [fullName, setFullName] = useState('');
  const [titulo, setTitulo] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [passCur, setPassCur] = useState('');
  const [passNew, setPassNew] = useState('');
  const [passConf, setPassConf] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!coach) return;
    setFullName(coach.name || '');
    setTitulo(coach.titulo || coach.title || '');
    setEmail(coach.email || '');
    setPhone(coach.phone || '');
    setAvatarUrl(coach.avatarUrl || null);
  }, [coach]);

  const onPickAvatar = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === 'string') setAvatarUrl(r.result);
    };
    r.readAsDataURL(f);
  };

  const onSave = async () => {
    try {
      const next = {
        ...coach,
        name: fullName.trim() || coach.name,
        titulo: titulo.trim(),
        title: titulo.trim(),
        email: email.trim(),
        phone: phone.trim(),
        avatarUrl: avatarUrl || coach.avatarUrl,
      };
      localStorage.setItem('it_session', JSON.stringify(next));
      setSessionData(next);

      if (sb && typeof sb.updateEntrenador === 'function') {
        await sb.updateEntrenador(entrenadorId, {
          nombre: next.name,
          titulo_profesional: next.titulo,
          email: next.email,
          telefono: next.phone,
          avatar_url: typeof avatarUrl === 'string' && avatarUrl.startsWith('http') ? avatarUrl : undefined,
        });
      }

      if (passNew && passNew === passConf && passNew.length >= 6 && supabase) {
        const { error } = await supabase.auth.updateUser({ password: passNew });
        if (error) {
          toast2('No se pudo cambiar la contraseña (sesión Supabase Auth)');
        } else {
          toast2('Contraseña actualizada ✓');
        }
        setPassCur('');
        setPassNew('');
        setPassConf('');
      } else if (passNew && passNew !== passConf) {
        toast2('Las contraseñas nuevas no coinciden');
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      toast2('Cambios guardados ✓');
    } catch (err) {
      toast2('Error al guardar');
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-10 pb-4 lg:pb-0">
      <div className="grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-2 xl:items-start xl:gap-10">
        <SectionCard title="Información personal" subtitle="Foto pública y datos que ven tus alumnos.">
          <div className="grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-[auto,1fr] lg:items-start lg:gap-10">
            <div className="flex justify-center lg:justify-start">
              <div className="relative">
                <div
                  className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-2xl text-2xl font-black text-white shadow-lg"
                  style={{
                    background: 'linear-gradient(145deg, #1d4ed8 0%, #2563eb 45%, #38bdf8 100%)',
                    fontFamily: 'inherit',
                  }}
                >
                  {avatarUrl && avatarUrl.startsWith('data:') ? (
                    <img src={avatarUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
                  ) : (
                    initials(fullName || coach?.name)
                  )}
                </div>
                <button
                  type="button"
                  className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0b111c] bg-blue-600 text-white shadow-md transition-transform hover:scale-105"
                  onClick={() => fileRef.current && fileRef.current.click()}
                  aria-label="Cambiar foto"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
              </div>
            </div>
            <p className="max-w-none text-center text-sm leading-relaxed text-white/45 lg:pt-2 lg:text-left">
              Subí una imagen desde la cámara. Si no hay foto, mostramos tus iniciales en la app.
            </p>
          </div>

          <div className="h-px w-full bg-white/[0.06]" />

          <div className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-7 md:grid-cols-2">
            <Field className="md:col-span-2" label="Nombre completo" value={fullName} onChange={setFullName} type="text" placeholder="Nombre y apellido" />
            <Field className="md:col-span-2" label="Título profesional" value={titulo} onChange={setTitulo} type="text" placeholder="Ej. Entrenador personal · Fuerza" />
            <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="correo@ejemplo.com" />
            <Field label="Teléfono" value={phone} onChange={setPhone} type="tel" placeholder="+54 9 11 …" />
          </div>
        </SectionCard>

        <SectionCard title="Cuenta" subtitle="Credenciales de acceso vía Supabase Auth.">
          <p className="text-sm leading-relaxed text-white/45">
            Actualizá tu contraseña cuando la cuenta use autenticación de Supabase.
          </p>
          <div className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-7 md:grid-cols-2">
            <Field label="Contraseña actual" value={passCur} onChange={setPassCur} type="password" placeholder="••••••••" />
            <Field label="Nueva contraseña" value={passNew} onChange={setPassNew} type="password" placeholder="Mínimo 6 caracteres" />
            <Field className="md:col-span-2" label="Confirmar nueva" value={passConf} onChange={setPassConf} type="password" placeholder="Repetí la nueva" />
          </div>
        </SectionCard>
      </div>

      <StickyActionBar>
        <Btn className="h-12 w-full text-[12px]" onClick={onSave}>
          {saved ? 'GUARDADO ✓' : 'GUARDAR CAMBIOS'}
        </Btn>
        {saved ? <span className="text-center text-xs text-emerald-400/95">Cambios guardados</span> : null}
      </StickyActionBar>

      <div className="hidden border-t border-white/[0.08] pt-8 lg:flex lg:justify-end">
        <Btn className="h-12 px-8 text-[12px]" onClick={onSave}>
          {saved ? 'GUARDADO ✓' : 'GUARDAR CAMBIOS'}
        </Btn>
        {saved ? <span className="ml-4 self-center text-xs text-emerald-400/95">Cambios guardados</span> : null}
      </div>
    </div>
  );
}
