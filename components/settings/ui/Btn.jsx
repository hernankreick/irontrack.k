import React from 'react';

export default function Btn({ variant = 'primary', children, onClick, icon, small, type = 'button', disabled, className = '' }) {
  const base =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-0 font-bold uppercase tracking-wider transition-all duration-200';
  const pad = small ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm';

  const hoverCls =
    disabled
      ? 'cursor-not-allowed'
      : variant === 'primary'
        ? 'cursor-pointer hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(37,99,235,0.38)] active:translate-y-0'
        : 'cursor-pointer hover:-translate-y-px active:translate-y-0';

  const styles = {
    primary: {
      background: '#2563EB',
      color: '#fff',
      boxShadow: 'none',
    },
    ghost: {
      background: 'rgba(255,255,255,0.06)',
      color: '#e2e8f0',
      border: '1px solid rgba(255,255,255,0.1)',
    },
    danger: {
      background: 'rgba(239,68,68,0.15)',
      color: '#EF4444',
      border: '1px solid rgba(239,68,68,0.35)',
    },
  };

  const v = styles[variant] || styles.primary;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${pad} ${hoverCls} ${className}`.trim()}
      style={{
        ...v,
        fontFamily: 'inherit',
        letterSpacing: '0.05em',
        fontWeight: 700,
        opacity: disabled ? (variant === 'danger' ? 0.4 : 0.5) : 1,
        ...(variant === 'primary' && !disabled ? { boxShadow: '0 4px 14px rgba(37,99,235,0.35)' } : {}),
      }}
    >
      {icon ? <span className="flex shrink-0">{icon}</span> : null}
      {children}
    </button>
  );
}
