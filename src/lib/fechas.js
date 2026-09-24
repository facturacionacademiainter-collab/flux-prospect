const pad = (n) => String(n).padStart(2, '0')

/** Fecha local en formato YYYY-MM-DD. */
export function isoLocal(fecha = new Date()) {
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`
}

export const hoyIso = () => isoLocal(new Date())

function aFecha(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function sumarDias(iso, dias) {
  const f = aFecha(iso)
  f.setDate(f.getDate() + dias)
  return isoLocal(f)
}

/** Lunes de la semana de la fecha dada (YYYY-MM-DD). */
export function inicioSemana(iso) {
  const f = aFecha(iso)
  const dia = (f.getDay() + 6) % 7
  f.setDate(f.getDate() - dia)
  return isoLocal(f)
}

/** Inicio del día local (ISO con zona) para filtrar timestamptz. */
export const inicioDiaTs = (iso) => aFecha(iso).toISOString()

/** Inicio del día siguiente (límite exclusivo). */
export const finDiaTs = (iso) => aFecha(sumarDias(iso, 1)).toISOString()

/** Fecha local (YYYY-MM-DD) de un timestamptz. */
export const isoDeTs = (ts) => isoLocal(new Date(ts))

export function formatoFecha(valor) {
  if (!valor) return '—'
  const f = typeof valor === 'string' && valor.length === 10 ? aFecha(valor) : new Date(valor)
  return f.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatoFechaHora(valor) {
  if (!valor) return '—'
  return new Date(valor).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function diasEntre(desdeIso, hastaIso) {
  return Math.round((aFecha(hastaIso) - aFecha(desdeIso)) / 86400000)
}
