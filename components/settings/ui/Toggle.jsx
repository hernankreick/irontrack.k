import React from 'react';

const track = {
  md: { w: 46, h: 24, thumb: 20, pad: 2 },
  sm: { w: 36, h: 20, thumb: 16, pad: 2 },
};

export default function Toggle({ checked, onChange, size = 'md' }) {
  const t = track[size] || track.md;
  const translateOn = t.w - t.pad * 2 - t.thumb;
  const onColor = '#2563EB';
  const offColor = 'rgba(255,255,255,0.1)';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f1a]"
    >
      <span
        className="relative block shrink-0 rounded-full"
        style={{
          width: t.w,
          height: t.h,
          background: checked ? onColor : offColor,
          transition: 'background 200ms ease',
        }}
      >
        <span
          className="absolute top-1/2 rounded-full bg-white shadow"
          style={{
            width: t.thumb,
            height: t.thumb,
            left: t.pad,
            transform: `translateY(-50%) translateX(${checked ? translateOn : 0}px)`,
            transition: 'transform 200ms ease',
          }}
        />
      </span>
    </button>
  );
}
