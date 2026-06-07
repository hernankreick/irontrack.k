export function StudentProgressEmptyState({ displayName, es, onRegistrarPrimerEntrenamiento }) {
  return (
    <div
      className="rounded-[24px] border"
      style={{
        padding: '20px 18px',
        borderColor: 'var(--sp-stroke)',
        boxSizing: 'border-box',
        overflow: 'visible',
        wordBreak: 'normal',
        background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.12), var(--sp-surface))',
      }}
    >
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1.15,
          marginBottom: 10,
          wordBreak: 'normal',
        }}
      >
        {es ? `Empecemos fuerte, ${displayName}.` : `Let's start strong, ${displayName}.`}
      </div>
      <p className="text-[13px]" style={{ color: 'var(--sp-muted)', lineHeight: 1.45, margin: 0 }}>
        {es
          ? 'Tu volumen y tus PRs aparecerán acá cuando registres entrenos. Empezá por una sesión completa.'
          : 'Volume and PRs show up here once you log workouts. Start with one full session.'}
      </p>
      <button
        type="button"
        className="mt-4 w-full rounded-full text-[13px] font-semibold transition-colors"
        style={{
          minHeight: 52,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          whiteSpace: 'normal',
          boxSizing: 'border-box',
          background: 'rgba(59, 130, 246, 0.18)',
          color: 'var(--sp-accent)',
          border: '1px solid rgba(59, 130, 246, 0.35)',
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.26)'
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.18)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.18)'
        }}
        onClick={() => onRegistrarPrimerEntrenamiento?.()}
      >
        {es ? 'Registrar primer entrenamiento' : 'Log first workout'}
      </button>
    </div>
  )
}
