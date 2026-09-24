import { supabase, ok } from './supabase'
import { SELECT_PROSPECTO } from './acciones'
import { hoyIso } from './fechas'

// Prospectos cargados por la tarea automática: quedan con revisar = true
// hasta que se aprueban (entran a Hoy/Pipeline/KPIs) o se descartan.

const EVENTO = 'flux:revision'

/** Avisa (p.ej. al contador de la navegación) que cambiaron los pendientes. */
export const avisarCambioRevision = () => window.dispatchEvent(new Event(EVENTO))

export function alCambiarRevision(fn) {
  window.addEventListener(EVENTO, fn)
  return () => window.removeEventListener(EVENTO, fn)
}

export async function contarPendientes() {
  const { count, error } = await supabase
    .from('prospectos')
    .select('id', { count: 'exact', head: true })
    .eq('revisar', true)
  if (error) throw error
  return count || 0
}

/** Aprueba uno o varios: salen de revisión y entran a la cola de hoy. */
export async function aprobarProspectos(ids) {
  if (!ids.length) return []
  const data = ok(
    await supabase
      .from('prospectos')
      .update({ revisar: false, proximo_toque: hoyIso() })
      .in('id', ids)
      .select(SELECT_PROSPECTO),
  )
  avisarCambioRevision()
  return data
}

/** Borra el prospecto y, si su empresa queda sin prospectos, también la empresa. */
export async function descartarProspecto(prospecto) {
  ok(await supabase.from('prospectos').delete().eq('id', prospecto.id))
  let empresaBorrada = false
  if (prospecto.empresa_id) {
    const { count, error } = await supabase
      .from('prospectos')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', prospecto.empresa_id)
    if (error) throw error
    if (!count) {
      ok(await supabase.from('empresas').delete().eq('id', prospecto.empresa_id))
      empresaBorrada = true
    }
  }
  avisarCambioRevision()
  return { empresaBorrada }
}
