import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigurado = Boolean(url && anonKey)

export const supabase = createClient(
  url || 'https://sin-configurar.supabase.co',
  anonKey || 'sin-configurar',
  { auth: { persistSession: true, autoRefreshToken: true } },
)

/** Trae todas las filas paginando (PostgREST corta en 1000 por defecto). */
export async function traerTodo(construirQuery, tamano = 1000) {
  const filas = []
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await construirQuery().range(desde, desde + tamano - 1)
    if (error) throw error
    filas.push(...data)
    if (data.length < tamano) break
  }
  return filas
}

/** Lanza el error de una respuesta de supabase-js si lo hay; devuelve data. */
export function ok({ data, error }) {
  if (error) throw error
  return data
}
