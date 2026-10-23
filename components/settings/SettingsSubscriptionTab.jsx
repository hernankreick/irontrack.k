import React from 'react';

function SubscriptionSectionTitle({ children, C }) {
  return (
    <div className="it-set-title" style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '1px',
      textTransform: 'uppercase', color: C.muted,
      marginBottom: 10, marginTop: 4,
    }}>{children}</div>
  );
}

function SubscriptionRow({ label, desc, children, C }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '14px 18px',
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: C.rCard, marginBottom: 8,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function SubscriptionUsageBar({ label, current, max, color, C }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
        <span style={{ color: C.sub }}>{label}</span>
        <span style={{ color: C.text, fontWeight: 600 }}>{current} / {max}</span>
      </div>
      <div style={{ height: 8, background: C.control, border: `1px solid ${C.border}`, boxSizing: 'content-box', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .8s ease' }} />
      </div>
    </div>
  );
}

export default function SettingsSubscriptionTab({
  C,
  t,
  renewal,
  alumnosCount,
  rutinasActivasCount,
}) {
  return (
    <div>
      <SubscriptionSectionTitle C={C}>{t.currentPlan}</SubscriptionSectionTitle>
      <div style={{
        background: C.subscriptionBanner,
        border: `1px solid ${C.blue}`, borderRadius: C.rCard, padding: '20px 22px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', background: C.blue, color: C.onBlue, display: 'inline-flex', padding: '2px 10px', borderRadius: C.pill, marginBottom: 10 }}>{t.active}</div>
        <div style={{ fontSize: 24, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2, color: C.text }}>IRONTRACK PRO</div>
        <div style={{ fontSize: 28, fontFamily: 'DM Mono, monospace', color: C.blueText, marginTop: 4 }}>$29 <span style={{ fontSize: 13, color: C.sub }}>{t.perMonth}</span></div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 10 }}>{t.nextRenewal}: {renewal}</div>
      </div>

      <SubscriptionSectionTitle C={C}>{t.planUsage}</SubscriptionSectionTitle>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: C.rCard, padding: '16px 18px', marginBottom: 8 }}>
        <SubscriptionUsageBar label={t.athletes} current={alumnosCount || 0} max={50} color={C.blue} C={C} />
        <SubscriptionUsageBar label={t.activeRoutines} current={rutinasActivasCount || 0} max={40} color={C.blueText} C={C} />
      </div>

      <SubscriptionSectionTitle C={C}>{t.billing}</SubscriptionSectionTitle>
      <SubscriptionRow label={t.paymentMethod} desc={t.paymentMethodDesc} C={C}>
        <button className="coach-tap" type="button" style={{ background: 'transparent', border: `1px solid ${C.borderStrong}`, borderRadius: C.rCtrl, padding: '6px 14px', fontSize: 12, color: C.sub, cursor: 'pointer', fontFamily: 'inherit' }}>{t.update}</button>
      </SubscriptionRow>
    </div>
  );
}
