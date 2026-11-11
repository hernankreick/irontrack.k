/** @typedef {{ kg: number, reps: number, fecha: string }} RawSet */

import { parseFechaDMY, parseFechaDMYToLocalDate } from '../../lib/progressDate.js'
import { compararVolumen } from '../../lib/metricas/volumen.js'
import { tipoDeCarga, TIPO_CARGA } from '../../lib/metricas/tipoCarga.js'
import { lunesDe, diaLocal } from '../../lib/metricas/fechas.js'
import { eventosPR, historialPorDia, recordDe, kgDeSerie } from '../../lib/metricas/pr.js'
import { isCompletedSession } from '../../lib/studentWeeklyProgress.js'

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/

/**
 * progreso.fecha es d/m/yyyy (toLocaleDateString es-AR). Se parsea de forma estricta; nunca Date.parse
 * sobre strings con "/". ISO explícito (YYYY-MM-DD[ T...]) solo para created_at como fallback.
 * Devuelve Date local o null.
 */
export function parseProgressDate(str) {
  if (typeof str !== 'string') return null
  const s = str.trim()
  if (!s) return null
  const dmy = parseFechaDMYToLocalDate(s)
  if (dmy) return dmy
  const m = ISO_RE.exec(s)
  if (!m) return null
  const y = +m[1]
  const mo = +m[2]
  const d = +m[3]
  const chk = new Date(Date.UTC(y, mo - 1, d))
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d) return null
  if (s.length === 10) return new Date(y, mo - 1, d)
  const t = new Date(s)
  return Number.isNaN(t.getTime()) ? null : t
}

export function dayKeyFromAny(str) {
  const d = parseProgressDate(str)
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Firma de una serie real: ejercicio + día + kg + reps. El día se normaliza (05/10/2026 == 5/10/2026);
 * si la fecha no es d/m/yyyy válido se usa el texto tal cual.
 */
function setSignature(exId, fecha, kg, reps) {
  const f = typeof fecha === 'string' ? fecha.trim() : fecha
  const day = parseFechaDMY(f)
  return `${String(exId)}|${day == null ? `raw:${String(fecha)}` : day}|${kg}|${reps}`
}

/**
 * Reconcilia filas locales (caché) con remotas (Supabase) por multiplicidad máxima:
 * para cada firma conserva max(cantidad local, cantidad remota) filas — nunca la suma (caché + servidor
 * duplicados) ni una sola (series reales idénticas del mismo día). Las filas repetidas dentro de una
 * misma fuente se conservan. Se prefieren las copias remotas en el solape; las locales sobrantes se agregan.
 * Pura y determinista: el orden de salida sigue el de primera aparición de cada firma.
 */
export function reconcileRowsByMaxMultiplicity(localRows, remoteRows, signatureOf) {
  const groups = new Map()
  const slot = (key) => {
    let g = groups.get(key)
    if (!g) {
      g = { local: [], remote: [] }
      groups.set(key, g)
    }
    return g
  }
  ;(localRows || []).forEach((r) => slot(signatureOf(r)).local.push(r))
  ;(remoteRows || []).forEach((r) => slot(signatureOf(r)).remote.push(r))
  const out = []
  groups.forEach((g) => {
    const keep = Math.max(g.local.length, g.remote.length)
    for (let i = 0; i < keep; i++) out.push(i < g.remote.length ? g.remote[i] : g.local[i])
  })
  return out
}

/**
 * Igual que getDatos en GraficoProgreso: combina local + Supabase (multiplicidad máxima) y ordena por fecha.
 */
export function mergeSetsForExercise(exId, progress, sbData) {
  return mergeAllSetsForExercise(exId, progress, sbData).slice(-20)
}

/**
 * D7.4: TODO el historial del ejercicio (local + Supabase, misma reconciliacion), del mas antiguo al mas reciente. Los records y los
 * PR se calculan sobre esto; mergeSetsForExercise (ultimas 20) queda solo para graficos y tendencias.
 */
export function mergeAllSetsForExercise(exId, progress, sbData) {
  const local = ((progress && progress[exId]?.sets) || [])
    .map((s) => ({
      kg: kgDeSerie(s.kg) || 0,
      reps: parseInt(s.reps, 10) || 0,
      fecha: s.date,
    }))
    .filter((s) => s.kg > 0)
  const remote = (sbData || [])
    .filter((d) => d.ejercicio_id === exId && kgDeSerie(d.kg) > 0)
    .map((d) => ({
      kg: kgDeSerie(d.kg),
      reps: parseInt(d.reps, 10) || 0,
      fecha: d.fecha,
    }))
  const ms = (r) => parseProgressDate(r.fecha)?.getTime() ?? -Infinity
  const todos = reconcileRowsByMaxMultiplicity(local, remote, (r) => setSignature(exId, r.fecha, r.kg, r.reps)).sort(
    (a, b) => {
      const ta = ms(a)
      const tb = ms(b)
      return ta === tb ? 0 : ta > tb ? 1 : -1
    }
  )
  return todos
}

/** Filas con ejercicio_id para lib/metricas/pr.js. */
function filasPR(exId, rows) {
  return (rows || []).map((r) => ({ ejercicio_id: exId, fecha: r.fecha, kg: r.kg, reps: r.reps }))
}

/** D7.4: record (kg) del ejercicio sobre TODO su historial, con la regla unica (series validas, sin ejercicios por tiempo). */
export function exerciseRecordKg(exId, progress, sbData, opts) {
  return recordDe(filasPR(exId, mergeAllSetsForExercise(exId, progress, sbData)), exId, { indiceTiempo: opts && opts.indiceTiempo })
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

/** Número de día LOCAL de una fecha d/m/aaaa o ISO (created_at), o null. */
function diaLocalDeValor(value) {
  const d = parseProgressDate(value)
  return d ? diaLocal(d) : null
}

function fechaDeDia(dia) {
  const u = new Date(dia * 86400000)
  return u.getUTCDate() + '/' + (u.getUTCMonth() + 1) + '/' + u.getUTCFullYear()
}

/**
 * P0-5: racha de días seguidos del alumno, separando la VIGENTE de las históricas.
 *  - día entrenado = sesión COMPLETADA (isCompletedSession; su `fecha` d/m/aaaa, o el día local de created_at si no la tiene) o al menos
 *    una serie registrada ese día (progreso local). Fechas siempre como día de calendario local; los días futuros no cuentan.
 *  - vigente: solo si el último día entrenado es HOY o AYER (la misma regla que la racha semanal del entrenador, lib/metricas/racha.js:
 *    la unidad en curso todavía sin registro no corta la racha, la anterior sí). Antes se anclaba al último día con registro aunque fuera
 *    de hace semanas y mostraba esa racha vieja como actual.
 *  - ultima: la racha que termina en el último día entrenado { dias, hasta: "d/m/aaaa" } (histórica si vigente = 0); mejor: la más larga.
 * No modifica sesiones ni series. opts.now (Date) solo para pruebas.
 * @returns {{ vigente: number, ultima: ({ dias: number, hasta: string } | null), mejor: number }}
 */
export function computeDayStreakDetail(sesiones, progress, opts) {
  const hoy = diaLocal(opts && opts.now ? opts.now : new Date())
  const dias = new Set()
  const add = (dia) => {
    if (dia != null && dia <= hoy) dias.add(dia)
  }
  ;(sesiones || []).forEach((s) => {
    if (!s || !isCompletedSession(s)) return
    const d = diaLocalDeValor(s.fecha)
    add(d != null ? d : diaLocalDeValor(s.created_at))
  })
  Object.values(progress || {}).forEach((pg) => {
    ;((pg && pg.sets) || []).forEach((st) => add(diaLocalDeValor(st && st.date)))
  })
  if (!dias.size) return { vigente: 0, ultima: null, mejor: 0 }
  const largoHasta = (fin) => {
    let n = 0
    while (dias.has(fin - n)) n += 1
    return n
  }
  const ultimoDia = Math.max(...dias)
  const ultima = { dias: largoHasta(ultimoDia), hasta: fechaDeDia(ultimoDia) }
  const vigente = ultimoDia >= hoy - 1 ? ultima.dias : 0
  let mejor = 0
  dias.forEach((d) => {
    if (!dias.has(d + 1)) mejor = Math.max(mejor, largoHasta(d))
  })
  return { vigente, ultima, mejor }
}

/** Racha VIGENTE en días seguidos (0 si el último día entrenado no es hoy ni ayer). Ver computeDayStreakDetail. */
export function computeDayStreak(sesiones, progress, opts) {
  return computeDayStreakDetail(sesiones, progress, opts).vigente
}

/**
 * Cuenta eventos de PR en el mes calendario actual con la regla unica (lib/metricas/pr.js): historial COMPLETO del ejercicio (antes
 * solo las ultimas 20 series: una carga menor que un record viejo podia contar como PR), un PR por ejercicio y dia, el primer registro
 * no cuenta e igualar tampoco.
 */
export function countPRsThisMonth(allEx, EX, progress, sbData, opts) {
  const now = opts && opts.now ? opts.now : new Date()
  const desde = diaLocal(new Date(now.getFullYear(), now.getMonth(), 1))
  const hasta = diaLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  let count = 0
  const exList = exercisesWithData(allEx, EX, progress, sbData)
  exList.forEach((e) => {
    const rows = filasPR(e.id, mergeAllSetsForExercise(e.id, progress, sbData))
    eventosPR(rows, { indiceTiempo: opts && opts.indiceTiempo }).forEach((ev) => {
      if (ev.dia >= desde && ev.dia <= hasta) count += 1
    })
  })
  return count
}

/**
 * P0-4: variación de CARGA (no «mejora» global): por ejercicio, mejor serie válida de la PRIMERA sesión contra la mejor serie válida de
 * la ÚLTIMA sesión, sobre todo su historial (local + Supabase). Sesión = día de calendario; la mejor serie del día y las series válidas
 * son las de los PR (historialPorDia, lib/metricas/pr.js: kg > 0, reps > 0, fecha válida, sin ejercicios por tiempo), así que el
 * calentamiento y las series de descarga no la distorsionan. Antes: primera vs última SERIE suelta de las últimas 20 (una descarga de
 * 70 kg tras subir de 100 a 110 daba −30 %). Solo mira kg: no dice nada de repeticiones ni de otras condiciones.
 * pct = promedio entre ejercicios con al menos dos sesiones (entero); null si ninguno las tiene (sin datos, no 0 %).
 * @returns {{ pct: (number|null), ejercicios: number }}
 */
export function variacionDeCargaPromedio(allEx, EX, progress, sbData, opts) {
  const indiceTiempo = opts && opts.indiceTiempo
  const pcts = []
  exercisesWithData(allEx, EX, progress, sbData).forEach((e) => {
    const dias = historialPorDia(filasPR(e.id, mergeAllSetsForExercise(e.id, progress, sbData)), e.id, { indiceTiempo })
    if (dias.length < 2) return
    const inicio = dias[0].kg
    const fin = dias[dias.length - 1].kg
    if (inicio > 0) pcts.push(((fin - inicio) / inicio) * 100)
  })
  if (!pcts.length) return { pct: null, ejercicios: 0 }
  const pct = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
  return { pct: pct === 0 ? 0 : pct, ejercicios: pcts.length }
}

/** Contrato anterior del export: el porcentaje de variacionDeCargaPromedio, o 0 sin datos. */
export function averageImprovementPercent(allEx, EX, progress, sbData, opts) {
  const r = variacionDeCargaPromedio(allEx, EX, progress, sbData, opts)
  return r.pct == null ? 0 : r.pct
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

/**
 * Volumen en kg·reps de un registro (una serie). D7.3: misma regla que el entrenador (lib/metricas/volumen.js): solo kg > 0 y reps > 0,
 * y nunca un ejercicio POR TIEMPO (sus reps son segundos; antes sumaba kg x segundos). `indiceTiempo` = indiceEjerciciosPorTiempo(...).
 */
export function rowVolumeKg(row, indiceTiempo) {
  const kg = parseFloat(row.kg) || 0
  const reps = parseInt(row.reps, 10) || 0
  if (!(kg > 0) || !(reps > 0)) return 0
  if (tipoDeCarga(row.ejercicio_id, indiceTiempo) === TIPO_CARGA.TIEMPO) return 0
  return kg * reps
}

/**
 * Todos los sets sueltos (local + remoto). Misma reconciliación que mergeSetsForExercise: multiplicidad máxima
 * por ejercicio + día + kg + reps (las series reales repetidas se conservan; caché + servidor no se duplican).
 */
export function collectAllProgressRows(progress, sbData) {
  const local = []
  Object.keys(progress || {}).forEach((exId) => {
    ;(progress[exId]?.sets || []).forEach((s) => {
      const kg = parseFloat(s.kg) || 0
      const reps = parseInt(s.reps, 10) || 0
      if (kg <= 0) return
      local.push({ ejercicio_id: exId, kg, reps, fecha: s.date })
    })
  })
  const remote = []
  ;(sbData || []).forEach((d) => {
    const kg = parseFloat(d.kg) || 0
    const reps = parseInt(d.reps, 10) || 0
    if (kg <= 0) return
    remote.push({ ejercicio_id: d.ejercicio_id, kg, reps, fecha: d.fecha })
  })
  return reconcileRowsByMaxMultiplicity(local, remote, (r) => setSignature(r.ejercicio_id, r.fecha, r.kg, r.reps))
}

function volumeInRange(rows, startMs, endMs, indiceTiempo) {
  let v = 0
  rows.forEach((r) => {
    const t = parseProgressDate(r.fecha)?.getTime()
    if (t == null || Number.isNaN(t)) return
    if (t >= startMs && t < endMs) v += rowVolumeKg(r, indiceTiempo)
  })
  return v
}

/** Toneladas totales en un intervalo [start, end). */
export function volumeTonnesBetween(rows, start, end, indiceTiempo) {
  return volumeInRange(rows, start.getTime(), end.getTime(), indiceTiempo) / 1000
}

/**
 * Modelo hero: volumen semana actual/previa, delta %, sparkline últimos 7 días (ton/día),
 * barras L–D para semana actual.
 */
export function buildWeeklyVolumeModel(progress, sbData, sesiones, now = new Date(), opts = {}) {
  const indiceTiempo = opts && opts.indiceTiempo
  const rows = collectAllProgressRows(progress, sbData)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const weekStart = mondayStart(today)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const prevWeekStart = new Date(weekStart)
  prevWeekStart.setDate(prevWeekStart.getDate() - 7)
  const prevWeekEnd = new Date(weekStart)

  const volWeekTon = volumeTonnesBetween(rows, weekStart, weekEnd, indiceTiempo)
  const volPrevTon = volumeTonnesBetween(rows, prevWeekStart, prevWeekEnd, indiceTiempo)

  // D7.3: «vs semana pasada» con la comparacion del entrenador (compararVolumen): MISMO tramo (lunes -> hoy contra lunes-7 -> hoy-7),
  // solo ejercicios presentes en ambos y sin % con base insuficiente. Antes: semana en curso parcial contra semana pasada COMPLETA
  // (un lunes daba -67 %), +100 % inventado con base 0 y mezcla de rutinas.
  const hoyDia = Math.round(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000)
  const lun = lunesDe(hoyDia)
  const cmp = compararVolumen(rows, { desde: lun, hasta: hoyDia }, { desde: lun - 7, hasta: hoyDia - 7 }, { indiceTiempo })
  const deltaPct = cmp.pct == null ? null : Math.round(cmp.pct) // la vista muestra un entero (como antes)
  const deltaMotivo = cmp.motivo

  /** Sparkline: últimos 7 días inclusive (toneladas por día). */
  const sparkDaily = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    const ton = volumeTonnesBetween(rows, d, next, indiceTiempo)
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
    deltaMotivo,
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

/**
 * Marcas de PR para el grafico. Con metric 'peso' y ctx.historial (TODO el historial del ejercicio) usa la regla unica: solo la mejor
 * serie de un dia que supera el record previo de todo el historial (la primera marca e igualar no son PR, aunque el grafico muestre un
 * rango recortado). ctx.clase devuelve tambien "iguala" para marcar records igualados.
 */
export function progressivePRMasks(sortedByDateAsc, metric, ctx) {
  if (metric === 'peso' && ctx && Array.isArray(ctx.historial)) {
    const clases = clasesPorDia(ctx.exId, ctx.historial, ctx.indiceTiempo)
    const marcado = {}
    return sortedByDateAsc.map((r) => {
      const dia = parseFechaDMY(typeof r.fecha === 'string' ? r.fecha.trim() : r.fecha)
      const c = dia == null ? null : clases[dia]
      if (!c || c.clase !== 'pr' || marcado[dia]) return false
      if (Math.round((kgDeSerie(r.kg) - c.kg) * 1000) !== 0) return false
      marcado[dia] = true
      return true
    })
  }
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

/** D7.4: clase de cada dia de un ejercicio sobre todo su historial: { dia: { kg, clase: "primera" | "pr" | "iguala" | null } }. */
export function clasesPorDia(exId, historial, indiceTiempo) {
  const out = {}
  historialPorDia(filasPR(exId, historial), exId, { indiceTiempo }).forEach((h) => { out[h.dia] = { kg: h.kg, clase: h.clase } })
  return out
}
