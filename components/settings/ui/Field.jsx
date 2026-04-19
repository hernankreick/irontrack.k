import React, { useState } from 'react';

/**
 * Campo de texto controlado. Misma API: label, value, onChange, type, placeholder, suffix, helpText, className
 */
export default function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  suffix,
  helpText,
  className = '',
}) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const isPwd = type === 'password';
  const inputType = isPwd && show ? 'text' : type;

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`.trim()}>
      {label ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      ) : null}
      <div
        className={`flex min-h-[44px] w-full min-w-0 items-stretch rounded-xl border bg-white/[0.03] transition-colors duration-150 ${
          focused ? 'border-blue-500/80 ring-2 ring-blue-500/20' : 'border-white/[0.09]'
        }`}
      >
        <input
          className="min-h-[44px] min-w-0 flex-1 border-0 bg-transparent px-3.5 py-2.5 text-[13px] leading-snug text-white outline-none placeholder:text-white/35 disabled:opacity-50"
          style={{ fontFamily: 'inherit' }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={inputType}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {isPwd ? (
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center border-0 bg-transparent text-white/45 transition-colors hover:text-white"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {show ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        ) : null}
        {suffix && !isPwd ? (
          <span className="flex items-center pr-3.5 text-[11px] text-white/45">{suffix}</span>
        ) : null}
      </div>
      {helpText ? <p className="text-xs leading-relaxed text-white/40">{helpText}</p> : null}
    </div>
  );
}
