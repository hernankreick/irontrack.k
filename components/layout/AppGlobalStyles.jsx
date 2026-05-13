import React from 'react';

export default function AppGlobalStyles({ darkMode, bgSub, textMain, border }) {
  return (
    <style dangerouslySetInnerHTML={{__html:
      "@import url(https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap);" +
      "*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;line-height:1.4;-webkit-font-smoothing:antialiased}input,textarea,select{outline:none!important}" +
      "html{scrollbar-color:"+(darkMode?"#64748b #0f172a":"#64748b #e2e8f0")+"}" +
      "::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-track{background:"+(darkMode?"rgba(15,23,42,.55)":"#e2e8f0")+";border-radius:8px}::-webkit-scrollbar-thumb{background:"+(darkMode?"#64748b":"#64748b")+";border-radius:8px;border:2px solid transparent;background-clip:padding-box}" +
      ".plan-main-scroll{scrollbar-gutter:stable;scrollbar-color:"+(darkMode?"#94a3b8 #0b1120":"#64748b #f1f5f9")+"}" +
      ".plan-main-scroll::-webkit-scrollbar{width:14px}" +
      ".plan-main-scroll::-webkit-scrollbar-track{background:"+(darkMode?"rgba(15,23,42,.65)":"#e8edf3")+";border-radius:10px;margin:4px 0}" +
      ".plan-main-scroll::-webkit-scrollbar-thumb{background:"+(darkMode?"#94a3b8":"#64748b")+";border-radius:10px;border:3px solid "+(darkMode?"#0b1120":"#f8fafc")+";background-clip:padding-box;min-height:48px}" +
      ".hov{transition:filter .15s ease,transform .15s ease,background-color .15s ease,border-color .15s ease,color .15s ease,opacity .15s ease;cursor:pointer}.hov:hover{filter:brightness(1.15)}" +
      "@keyframes successPulse{0%{transform:scale(1)}30%{transform:scale(0.94)}60%{transform:scale(1.06)}100%{transform:scale(1)}}" +
      "@keyframes pillBounce{0%{transform:scale(1)}30%{transform:scale(1.25)}50%{transform:scale(0.9)}70%{transform:scale(1.1)}100%{transform:scale(1)}}" +
      "@keyframes greenFlash{0%{filter:brightness(1)}40%{filter:brightness(1.5) saturate(1.3)}100%{filter:brightness(1)}}" +
      "@keyframes bounceIn{0%{transform:scale(0) rotate(-10deg);opacity:0}50%{transform:scale(1.2) rotate(5deg)}70%{transform:scale(0.92) rotate(-2deg)}100%{transform:scale(1) rotate(0);opacity:1}}" +
      "@keyframes rippleOut{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}100%{box-shadow:0 0 0 20px rgba(34,197,94,0)}}" +

      ".num{font-family:'Barlow Condensed',sans-serif;font-variant-numeric:tabular-nums}" +
      "*{-webkit-tap-highlight-color:transparent}[style*='overflowY']{-webkit-overflow-scrolling:touch}.plan-main-scroll{scroll-behavior:auto!important;overflow-anchor:none;overscroll-behavior-y:contain}" +
      ".plan-scroll-diag-no-hov .hov{transition:none!important;filter:none!important}" +
      ".plan-hoy-cta-wrap{min-height:228px;touch-action:manipulation;box-sizing:border-box;background-clip:padding-box;border-style:solid;border-width:1px;filter:none;box-shadow:none}" +
      ".plan-hoy-cta-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:4px;min-height:128px;flex-shrink:0}" +
      ".plan-hoy-cta-kicker{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;line-height:1.2}" +
      ".plan-hoy-cta-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:22px;font-weight:900;line-height:1.2;word-break:break-word}" +
      ".plan-hoy-cta-sub{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;line-height:1.35;margin-top:4px;margin-bottom:14px;word-break:break-word}" +
      ".plan-hoy-cta-badge{flex-shrink:0;align-self:flex-start;white-space:nowrap;font-size:12px;font-weight:700;border-radius:8px;padding:3px 10px;border-style:solid;border-width:1px;line-height:1.2;filter:none;box-shadow:none;transition:none}" +
      ".plan-hoy-cta-btn{touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:none!important;box-sizing:border-box;height:52px;flex-shrink:0;filter:none;box-shadow:none;outline:none}" +
      ".plan-hoy-cta-btn svg{flex-shrink:0;display:block}" +
      ".card-ex{will-change:transform;contain:layout style paint}" +
      "@keyframes checkPop{0%{transform:scale(0.3) rotate(-15deg);opacity:0}60%{transform:scale(1.3) rotate(5deg);opacity:1}80%{transform:scale(0.9) rotate(-3deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}@keyframes slideUpFade{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}@keyframes prGlow{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.6);transform:scale(1)}50%{box-shadow:0 0 0 12px rgba(34,197,94,0);transform:scale(1.05)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0);transform:scale(1)}}@keyframes rowComplete{0%{background:rgba(34,197,94,0.0)}15%{background:rgba(34,197,94,0.3)}100%{background:transparent}}" +
      "select{background:"+bgSub+";color:"+textMain+";border:1px solid "+border+";border-radius:8px;padding:8px 12px;font-family:Inter,sans-serif;font-size:13px;width:100%}" +
      ".add-ex-hscroll{scrollbar-width:none;-ms-overflow-style:none;overscroll-behavior-x:contain;touch-action:pan-x pan-y}" +
      ".add-ex-hscroll::-webkit-scrollbar{display:none;height:0;width:0}" +
      ".add-ex-list-scroll--desktop{scrollbar-gutter:stable;scrollbar-width:thin;-webkit-overflow-scrolling:touch}" +
      ".add-ex-list-scroll--desktop::-webkit-scrollbar{width:10px}" +
      ".add-ex-list-scroll--desktop::-webkit-scrollbar-track{background:transparent}" +
      ".add-ex-list-scroll--desktop::-webkit-scrollbar-thumb{background:"+(darkMode?"#475569":"#94a3b8")+";border-radius:99px;border:2px solid transparent;background-clip:padding-box}" +
      ".add-ex-card{cursor:pointer;border-radius:12px;border:none;transition:background-color .15s ease;filter:none!important;outline:none;-webkit-focus-ring-color:transparent;-webkit-tap-highlight-color:transparent;position:relative}" +
      ".add-ex-card--light{background:#E2E8F0}.add-ex-card--light:hover{background:#d6dee9}" +
      ".add-ex-card--dark{background:#162234}.add-ex-card--dark:hover{background:#1c2d45}" +
      ".app-inner{max-width:1200px;margin:0 auto;width:100%}" +
      "@media(min-width:768px){" +
      ".app-inner{font-size:142%}" +
      ".tab-content{padding:24px 32px!important}" +
      ".card-item{padding:18px 22px!important}" +
      "nav{justify-content:center;max-width:700px;margin:0 auto}" +
      "nav>*{max-width:140px;font-size:15px!important;padding:12px 0!important}" +
      "nav>* i{font-size:24px!important}" +
      ".scroll-area{padding:24px 32px!important;max-width:860px;margin:0 auto}" +
      ".sk{background:linear-gradient(90deg,var(--sk1,#1E2D40) 25%,var(--sk2,#2D4057) 50%,var(--sk1,#1E2D40) 75%);background-size:200% 100%;animation:shimmer 1.4s ease-in-out infinite;border-radius:8px;}@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}" +
      "}"
    }}/>
  );
}
