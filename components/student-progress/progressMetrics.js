/** @typedef {{ kg: number, reps: number, fecha: string }} RawSet */

export function parseProgressDate(str) {
  if (!str) return null
  const t = Date.parse(str)
  if (!Number.isNaN(t)) return new Date(t)
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(str).trim())
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])
  return null
}

export function dayKeyFromAny(str) {
  const d = parseProgressDate(str)
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Igual que getDatos en GraficoProgreso: combina local + Supabase y dedupe.
 */
export function mergeSetsForExercise(exId, progress, sbData) {
  const local = (progress[exId]?.sets || [])
    .map((s) => ({
      kg: parseFloat(s.kg) || 0,
      reps: parseInt(s.reps, 10) || 0,
      fecha: s.date,
    }))
    .filter((s) => s.kg > 0)
  const remote = (sbData || [])
    .filter((d) => d.ejercicio_id === exId && parseFloat(d.kg) > 0)
    .map((d) => ({
      kg: parseFloat(d.kg),
      reps: parseInt(d.reps, 10) || 0,
      fecha: d.fecha,
    }))
  const todos = [...local, ...remote].sort((a, b) => {
    const da = a.fecha ? String(a.fecha).split('/').reverse().join('-') : ''
    const db = b.fecha ? String(b.fecha).split('/').reverse().join('-') : ''
    return da > db ? 1 : -1
  })
  const seen = new Set()
  return todos.filter((d) => {
    const k = String(d.fecha) + d.kg
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(-20)
}

export function exercisesWithData(allEx, EX, progress, sbData) {
  const list = allEx || EX || []
  return list.filter((e) => {
    const hasLocal = (progress[e.id]?.sets || []).some((s) => parseFloat(s.kg) > 0)
    const hasRemote = (sbData || []).some((d) => d.ejercicio_id === e.id && parseFloat(d.kg) > 0)
    return hasLocal || hasRemote
  })
}

function sortDatesDesc(keys) {
  return [...keys].sort((a, b) => b.localeCompare(a))
}

/** Racha en días consecutivos con al menos un registro (hoy o ayer como ancla). */
export function computeDayStreak(sesiones, progress) {
  const keys = new Set()
  ;(sesiones || []).forEach((s) => {
    const k = dayKeyFromAny(s.fecha)
    if (k) keys.add(k)
  })
  Object.values(progress || {}).forEach((pg) => {
    ;(pg.sets || []).forEach((st) => {
      const k = dayKeyFromAny(st.date)
      if (k) keys.add(k)
    })
  })
  if (keys.size === 0) return 0
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const y = new Date(today)
  y.setDate(y.getDate() - 1)
  const todayK = fmt(today)
  const yesterdayK = fmt(y)
  let anchor = keys.has(todayK) ? new Date(today) : null
  if (!anchor && keys.has(yesterdayK)) {
    anchor = new Date(y)
  }
  if (!anchor) {
    const sorted = sortDatesDesc([...keys])
    const first = sorted[0]
    if (!first) return 0
    const [yy, mm, dd] = first.split('-').map(Number)
    anchor = new Date(yy, mm - 1, dd)
  }
  let streak = 0
  let cursor = new Date(anchor)
  cursor.setHours(0, 0, 0, 0)
  while (keys.has(fmt(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Cuenta eventos de PR (superar el máximo previo) en el mes calendario actual. */
export function countPRsThisMonth(allEx, EX, progress, sbData) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const inMonth = (fechaStr) => {
    const d = parseProgressDate(fechaStr)
    if (!d) return false
    return d.getFullYear() === y && d.getMonth() === m
  }
  let count = 0
  const exList = exercisesWithData(allEx, EX, progress, sbData)
  exList.forEach((e) => {
    const datos = mergeSetsForExercise(e.id, progress, sbData)
    if (datos.length < 2) return
    const sorted = [...datos].sort((a, b) => {
      const da = parseProgressDate(a.fecha)?.getTime() ?? 0
      const db = parseProgressDate(b.fecha)?.getTime() ?? 0
      return da - db
    })
    let runningMax = sorted[0].kg
    for (let i = 1; i < sorted.length; i++) {
      const row = sorted[i]
      if (row.kg > runningMax && inMonth(row.fecha)) count += 1
      runningMax = Math.max(runningMax, row.kg)
    }
  })
  return count
}

export function averageImprovementPercent(allEx, EX, progress, sbData) {
  const exList = exercisesWithData(allEx, EX, progress, sbData)
  const pcts = []
  exList.forEach((e) => {
    const datos = mergeSetsForExercise(e.id, progress, sbData)
    if (datos.length < 2) return
    const ultimo = datos[datos.length - 1]
    const primero = datos[0]
    if (primero.kg > 0) {
      pcts.push(Math.round(((ultimo.kg - primero.kg) / primero.kg) * 100))
    }
  })
  if (!pcts.length) return 0
  return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
}

export function mapMuscleLabel(ex) {
  const raw = (ex.muscle || '').trim()
  if (!raw) return 'Full Body'
  return raw
}

export function exerciseMatchesMuscleFilter(ex, filterLabel) {
  if (!filterLabel || filterLabel === 'Todos') return true
  const m = (ex.muscle || '').toLowerCase()
  const f = filterLabel.toLowerCase()
  return m.includes(f) || f.includes(m.slice(0, 4))
}
