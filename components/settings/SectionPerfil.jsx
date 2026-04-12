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
    <div className="flex w-full flex-col space-y-8">
      <SectionCard title="Perfil" subtitle="Foto visible para tus alumnos y en la app.">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-lg font-black text-white"
              style={{
                background: 'linear-gradient(135deg, #1e40af 0%, #2563EB 50%, #3b82f6 100%)',
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
              className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 min-h-[36px] min-w-[36px] items-center justify-center rounded-full border-2 border-[#0d1424] bg-[#2563EB] text-white shadow-lg"
              onClick={() => fileRef.current && fileRef.current.click()}
              aria-label="Cambiar foto"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
          </div>
          <p className="max-w-md text-center text-sm leading-relaxed sm:text-left" style={{ color: '#64748b' }}>
            Tocá el ícono de cámara para subir una imagen. Si no hay foto, usamos tus iniciales.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Datos personales" subtitle="Nombre, título profesional y contacto.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5">
          <Field label="Nombre completo" value={fullName} onChange={setFullName} type="text" placeholder="Nombre y apellido" />
          <Field label="Título profesional" value={titulo} onChange={setTitulo} type="text" placeholder="Ej. Entrenador personal · Fuerza" />
          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="correo@ejemplo.com" />
          <Field label="Teléfono" value={phone} onChange={setPhone} type="tel" placeholder="+54 9 11 …" />
        </div>
      </SectionCard>

      <SectionCard title="Seguridad" subtitle="Contraseña de acceso (Supabase Auth).">
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-white/50">
            Cambiá tu contraseña si tu cuenta usa Supabase Auth.
          </p>
          <Field label="Contraseña actual" value={passCur} onChange={setPassCur} type="password" placeholder="••••••••" />
          <Field label="Nueva contraseña" value={passNew} onChange={setPassNew} type="password" placeholder="Mínimo 6 caracteres" />
          <Field label="Confirmar nueva" value={passConf} onChange={setPassConf} type="password" placeholder="Repetí la nueva" />
        </div>
      </SectionCard>

      <StickyActionBar>
        <Btn className="w-full" onClick={onSave}>
          {saved ? 'GUARDADO ✓' : 'GUARDAR CAMBIOS'}
        </Btn>
        {saved ? (
          <span className="text-xs opacity-90" style={{ color: '#22C55E' }}>
            Cambios guardados
          </span>
        ) : null}
      </StickyActionBar>

      <div className="mt-8 hidden flex-wrap items-center gap-3 sm:flex">
        <Btn onClick={onSave}>{saved ? 'GUARDADO ✓' : 'GUARDAR CAMBIOS'}</Btn>
        {saved ? (
          <span className="text-xs opacity-90" style={{ color: '#22C55E' }}>
            Cambios guardados
          </span>
        ) : null}
      </div>
    </div>
  );
}
