import React, { useState } from 'react';

export default function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  suffix,
}) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const isPwd = type === 'password';
  const inputType = isPwd && show ? 'text' : type;

  return (
    <div className="w-full space-y-2">
      {label ? (
        <div
          className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#64748b]"
          style={{ fontFamily: 'inherit' }}
        >
          {label}
        </div>
      ) : null}
      <div
        className={`flex min-h-[36px] w-full items-stretch overflow-hidden rounded-lg border bg-white/5 transition-[border-color,box-shadow] duration-150 ${
          focused ? 'border-[#2563EB]' : 'border-white/10'
        }`}
        style={focused ? { boxShadow: '0 0 0 3px rgba(37,99,235,0.14)' } : undefined}
      >
        <input
          className="min-h-[36px] min-w-0 flex-1 border-0 bg-transparent px-[11px] py-[9px] text-xs leading-snug text-white outline-none placeholder:text-white/40 disabled:opacity-50"
          style={{ fontFamily: 'inherit', fontSize: '12px' }}
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
            className="flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center border-0 bg-transparent px-1 text-white/50 transition-colors hover:text-white"
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
          <span className="flex items-center pr-3 text-[11px] text-white/50">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}
