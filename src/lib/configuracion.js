import { supabase, ok } from './supabase'
import { CADENCIAS_DEFAULT, METAS_DEFAULT, LIMITE_INVITACIONES_DEFAULT } from './constantes'

const DEFAULTS = {
  cadencias: CADENCIAS_DEFAULT,
  limite_invitaciones_diarias: LIMITE_INVITACIONES_DEFAULT,
  metas_semanales: METAS_DEFAULT,
}

/** Devuelve la fila de configuración del usuario; si no existe, la crea con defaults. */
export async function asegurarConfiguracion(ownerId) {
  const existente = ok(await supabase.from('configuracion').select('*').eq('owner_id', ownerId).maybeSingle())
  if (existente) return existente
  const { data, error } = await supabase
    .from('configuracion')
    .insert({ owner_id: ownerId, ...DEFAULTS })
    .select()
    .single()
  if (!error) return data
  // Otra pestaña la pudo haber creado en paralelo.
  if (error.code === '23505') {
    return ok(await supabase.from('configuracion').select('*').eq('owner_id', ownerId).single())
  }
  throw error
}

export async function guardarConfiguracion(ownerId, cambios) {
  return ok(await supabase.from('configuracion').update(cambios).eq('owner_id', ownerId).select().single())
}
