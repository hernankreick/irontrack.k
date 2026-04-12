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
    <label className="mb-0 block w-full">
      {label ? (
        <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>
          {label}
        </span>
      ) : null}
      <div
        className="flex min-h-[44px] w-full items-stretch overflow-hidden rounded-xl border"
        style={{
          borderColor: focused ? '#2563EB' : 'rgba(255,255,255,0.08)',
          background: focused ? '#0a0f1a' : 'rgba(255,255,255,0.02)',
          boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
        }}
      >
        <input
          className="min-h-[44px] min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-[15px] leading-snug text-white outline-none placeholder:text-[#64748b]"
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
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center border-0 bg-transparent px-1 text-[#64748b] hover:text-white"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {show ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        ) : null}
        {suffix && !isPwd ? (
          <span className="flex items-center pr-4 text-[13px]" style={{ color: '#64748b' }}>
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}
