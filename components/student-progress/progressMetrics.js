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

/** Inicio del lunes de la semana ISO (lunes = inicio). */
export function mondayStart(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

/** Volumen en kg·reps de un registro (una serie). */
export function rowVolumeKg(row) {
  const kg = parseFloat(row.kg) || 0
  const reps = parseInt(row.reps, 10) || 0
  return kg * reps
}

/**
 * Todos los sets sueltos (local + remoto, dedupe por ejercicio+fecha+kg como mergeSets).
 */
export function collectAllProgressRows(progress, sbData) {
  const out = []
  const seen = new Set()
  Object.keys(progress || {}).forEach((exId) => {
    ;(progress[exId]?.sets || []).forEach((s) => {
      const kg = parseFloat(s.kg) || 0
      const reps = parseInt(s.reps, 10) || 0
      if (kg <= 0) return
      const fecha = s.date
      const k = `${exId}|${fecha}|${kg}|${reps}`
      if (seen.has(k)) return
      seen.add(k)
      out.push({ ejercicio_id: exId, kg, reps, fecha })
    })
  })
  ;(sbData || []).forEach((d) => {
    const kg = parseFloat(d.kg) || 0
    const reps = parseInt(d.reps, 10) || 0
    if (kg <= 0) return
    const exId = d.ejercicio_id
    const fecha = d.fecha
    const k = `${exId}|${fecha}|${kg}|${reps}`
    if (seen.has(k)) return
    seen.add(k)
    out.push({ ejercicio_id: exId, kg, reps, fecha })
  })
  return out
}

function volumeInRange(rows, startMs, endMs) {
  let v = 0
  rows.forEach((r) => {
    const t = parseProgressDate(r.fecha)?.getTime()
    if (t == null || Number.isNaN(t)) return
    if (t >= startMs && t < endMs) v += rowVolumeKg(r)
  })
  return v
}

/** Toneladas totales en un intervalo [start, end). */
export function volumeTonnesBetween(rows, start, end) {
  return volumeInRange(rows, start.getTime(), end.getTime()) / 1000
}

/**
 * Modelo hero: volumen semana actual/previa, delta %, sparkline últimos 7 días (ton/día),
 * barras L–D para semana actual.
 */
export function buildWeeklyVolumeModel(progress, sbData, sesiones, now = new Date()) {
  const rows = collectAllProgressRows(progress, sbData)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const weekStart = mondayStart(today)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const prevWeekStart = new Date(weekStart)
  prevWeekStart.setDate(prevWeekStart.getDate() - 7)
  const prevWeekEnd = new Date(weekStart)

  const volWeekTon = volumeTonnesBetween(rows, weekStart, weekEnd)
  const volPrevTon = volumeTonnesBetween(rows, prevWeekStart, prevWeekEnd)

  let deltaPct = null
  if (volPrevTon > 1e-6) {
    deltaPct = Math.round(((volWeekTon - volPrevTon) / volPrevTon) * 100)
  } else if (volWeekTon > 1e-6) {
    deltaPct = 100
  }

  /** Sparkline: últimos 7 días inclusive (toneladas por día). */
  const sparkDaily = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    const ton = volumeTonnesBetween(rows, d, next)
    sparkDaily.push(Math.max(0, ton))
  }

  /** Días L–D con entreno: sesión o al menos un set ese día. */
  const sessionDayKeys = new Set()
  ;(sesiones || []).forEach((s) => {
    const k = dayKeyFromAny(s.fecha || s.created_at)
    if (k) sessionDayKeys.add(k)
  })
  rows.forEach((r) => {
    const k = dayKeyFromAny(r.fecha)
    if (k) sessionDayKeys.add(k)
  })

  const letters = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const bars = letters.map((letter, idx) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + idx)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const hit = sessionDayKeys.has(k)
    const isToday = k === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return { letter, dayKey: k, hit, isToday }
  })

  return {
    volWeekTon,
    volPrevTon,
    deltaPct,
    sparkDaily,
    weekBars: bars,
  }
}

export function hasAnyTrainingData(sesiones, progress, sbData) {
  if ((sesiones || []).length > 0) return true
  return collectAllProgressRows(progress, sbData).length > 0
}

/** Count distinct training days in current Mon–Sun week. */
export function trainingDaysThisWeek(sesiones, progress, sbData, now = new Date()) {
  const keys = new Set()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const ws = mondayStart(today)
  const we = new Date(ws)
  we.setDate(we.getDate() + 7)
  const inWeek = (ms) => ms >= ws.getTime() && ms < we.getTime()

  ;(sesiones || []).forEach((s) => {
    const t = new Date(s.created_at || s.fecha || 0).getTime()
    if (!Number.isNaN(t) && inWeek(t)) {
      const k = dayKeyFromAny(s.fecha || s.created_at)
      if (k) keys.add(k)
    }
  })
  collectAllProgressRows(progress, sbData).forEach((r) => {
    const d = parseProgressDate(r.fecha)
    if (!d) return
    const t = d.getTime()
    if (inWeek(t)) {
      const k = dayKeyFromAny(r.fecha)
      if (k) keys.add(k)
    }
  })
  return keys.size
}

/** Serie temporal filtrada por rango (meses o años). */
export function filterRowsByRange(datos, rangeKey, now = new Date()) {
  if (!datos?.length) return []
  const end = now.getTime()
  let startMs = end
  if (rangeKey === '1M') startMs = end - 30 * 86400000
  else if (rangeKey === '3M') startMs = end - 90 * 86400000
  else if (rangeKey === '6M') startMs = end - 182 * 86400000
  else if (rangeKey === '1Y' || rangeKey === '1A') startMs = end - 365 * 86400000
  else startMs = end - 365 * 86400000

  return datos.filter((r) => {
    const t = parseProgressDate(r.fecha)?.getTime()
    return t != null && !Number.isNaN(t) && t >= startMs && t <= end
  })
}

/** Promedio móvil simple de ventana `win`. */
export function movingAverage(values, win) {
  if (!values.length) return []
  const out = []
  for (let i = 0; i < values.length; i++) {
    const from = Math.max(0, i - win + 1)
    const slice = values.slice(from, i + 1)
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length
    out.push(avg)
  }
  return out
}

export function progressivePRMasks(sortedByDateAsc, metric) {
  let maxKg = -Infinity
  let maxReps = -Infinity
  let maxVol = -Infinity
  return sortedByDateAsc.map((r) => {
    const kg = parseFloat(r.kg) || 0
    const reps = parseInt(r.reps, 10) || 0
    const vol = kg * reps
    let pr = false
    if (metric === 'peso') {
      if (kg > maxKg) pr = true
      maxKg = Math.max(maxKg, kg)
    } else if (metric === 'reps') {
      if (reps > maxReps) pr = true
      maxReps = Math.max(maxReps, reps)
    } else {
      if (vol > maxVol) pr = true
      maxVol = Math.max(maxVol, vol)
    }
    return pr
  })
}
