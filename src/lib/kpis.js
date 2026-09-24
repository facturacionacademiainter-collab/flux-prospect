import { ESTADOS } from './constantes'
import { inicioSemana, isoDeTs, sumarDias } from './fechas'

/**
 * Contadores automáticos. Cada actividad cuenta una sola vez por métrica,
 * aunque cumpla más de una condición (p.ej. tipo 'demo' + estado 'Demo hecha').
 */
export const METRICAS = [
  { clave: 'invitaciones', etiqueta: 'Invitaciones enviadas', cuenta: (a) => a.tipo === 'invitación' },
  {
    clave: 'aceptaciones',
    etiqueta: 'Aceptaciones',
    cuenta: (a) => a.tipo === 'aceptación' || a.estado_nuevo === 'Conectado',
  },
  { clave: 'mensajes', etiqueta: 'Mensajes enviados', cuenta: (a) => a.tipo === 'mensaje' || a.tipo === 'follow-up' },
  { clave: 'respuestas', etiqueta: 'Respuestas', cuenta: (a) => a.tipo === 'respuesta' || a.estado_nuevo === 'Respondió' },
  { clave: 'llamadas', etiqueta: 'Llamadas', cuenta: (a) => a.tipo === 'llamada' },
  {
    clave: 'demos',
    etiqueta: 'Demos coordinadas',
    cuenta: (a) => a.tipo === 'reunión' || a.estado_nuevo === 'Demo agendada',
  },
  { clave: 'demos_hechas', etiqueta: 'Demos hechas', cuenta: (a) => a.tipo === 'demo' || a.estado_nuevo === 'Demo hecha' },
  { clave: 'diagnosticos', etiqueta: 'Diagnósticos', cuenta: (a) => a.estado_nuevo === 'Diagnóstico en curso' },
  { clave: 'propuestas', etiqueta: 'Propuestas', cuenta: (a) => a.tipo === 'propuesta' || a.estado_nuevo === 'Propuesta' },
  { clave: 'clientes', etiqueta: 'Clientes', cuenta: (a) => a.estado_nuevo === 'Cliente' },
]

export const etiquetaMetrica = (clave) => METRICAS.find((m) => m.clave === clave)?.etiqueta ?? clave

/** Clave con la que se guarda el ajuste: por segmento si hay filtro. */
export const claveAjuste = (clave, segmento) => (segmento ? `${clave}|${segmento}` : clave)

export function contarAutomatico(actividades) {
  const r = Object.fromEntries(METRICAS.map((m) => [m.clave, 0]))
  for (const a of actividades) for (const m of METRICAS) if (m.cuenta(a)) r[m.clave] += 1
  return r
}

/** Suma de ajustes manuales por métrica (ya filtrados por rango y segmento). */
export function sumarAjustes(ajustes, segmento) {
  const r = Object.fromEntries(METRICAS.map((m) => [m.clave, 0]))
  for (const aj of ajustes) {
    const [clave, seg] = aj.metrica.split('|')
    if ((seg || '') !== (segmento || '')) continue
    if (clave in r) r[clave] += Number(aj.valor) || 0
  }
  return r
}

export const tasa = (num, den) => (den > 0 ? num / den : null)
export const formatoTasa = (t) => (t == null ? '—' : `${Math.round(t * 1000) / 10}%`)

/** Actividad agrupada por semana (lunes) dentro del rango. */
export function actividadPorSemana(actividades, desde, hasta) {
  const semanas = []
  for (let s = inicioSemana(desde); s <= hasta; s = sumarDias(s, 7)) {
    semanas.push({ semana: s, invitaciones: 0, mensajes: 0, respuestas: 0, demos: 0 })
  }
  const indice = Object.fromEntries(semanas.map((s, i) => [s.semana, i]))
  const porClave = Object.fromEntries(METRICAS.map((m) => [m.clave, m]))
  for (const a of actividades) {
    const fila = semanas[indice[inicioSemana(isoDeTs(a.fecha))]]
    if (!fila) continue
    for (const k of ['invitaciones', 'mensajes', 'respuestas', 'demos']) if (porClave[k].cuenta(a)) fila[k] += 1
  }
  return semanas
}

/** Embudo: cuántos prospectos alcanzaron al menos cada etapa (según su estado actual). */
export function embudo(prospectos) {
  const orden = ESTADOS.filter((e) => e !== 'No interesado')
  const actuales = Object.fromEntries(ESTADOS.map((e) => [e, 0]))
  for (const p of prospectos) actuales[p.estado] = (actuales[p.estado] || 0) + 1
  return orden.map((estado, i) => ({
    estado,
    actuales: actuales[estado],
    alcanzaron: orden.slice(i).reduce((s, e) => s + actuales[e], 0),
  }))
}

/** Rendimiento por grupo (segmento o plantilla) a partir de actividades. */
export function rendimientoPor(actividades, obtenerGrupo) {
  const grupos = new Map()
  for (const a of actividades) {
    const g = obtenerGrupo(a)
    if (!g) continue
    if (!grupos.has(g)) grupos.set(g, { grupo: g, ...contarAutomatico([]) })
    const fila = grupos.get(g)
    for (const m of METRICAS) if (m.cuenta(a)) fila[m.clave] += 1
  }
  return [...grupos.values()]
}
