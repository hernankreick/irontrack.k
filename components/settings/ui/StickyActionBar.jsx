import React from 'react';

const GRADIENT_BG =
  'linear-gradient(to top, #0a0f1a 0%, rgba(10,15,26,0.94) 45%, rgba(10,15,26,0.55) 78%, transparent 100%)';

const ROOT_CLASS =
  'transition-all duration-300 translate-y-0 lg:hidden sticky bottom-0 z-[70] -mx-4 px-4 pt-4 pb-[max(12px,env(safe-area-inset-bottom))] sm:-mx-5 sm:px-5 md:-mx-6 md:px-6';

export default function StickyActionBar({ children, show = true }) {
  if (show === false) return null;

  return (
    <div className={ROOT_CLASS} style={{ background: GRADIENT_BG }}>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
