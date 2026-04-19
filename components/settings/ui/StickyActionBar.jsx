import React from 'react';

const BAR =
  'sticky bottom-0 z-[70] sm:hidden -mx-4 px-4 pt-4 md:-mx-6 md:px-6 lg:-mx-10 lg:px-10 xl:-mx-12 xl:px-12';

export default function StickyActionBar({ children, show = true }) {
  if (show === false) return null;

  return (
    <div className={BAR}>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 top-0 -z-10"
        style={{
          background: 'linear-gradient(to top, #070a12 0%, rgba(7,10,18,0.92) 55%, rgba(7,10,18,0.35) 88%, transparent 100%)',
        }}
        aria-hidden
      />
      <div className="mx-auto w-full max-w-[1200px] pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="rounded-2xl border border-white/[0.09] border-b-0 bg-[#0a101c]/95 px-4 py-4 shadow-[0_-28px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="flex flex-col gap-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
