// Helpers compartidos por cargar-auto.mjs y nombres-existentes.mjs.
// Sin dependencias (Node 18+, fetch nativo). No usan la contraseña del usuario:
// solo la anon key pública + FLUX_CLAVE_CARGA contra funciones RPC security definer.
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Lee .env (si existe) sin pisar variables ya definidas en el entorno. */
function cargarDotEnv() {
  const ruta = resolve(raiz, '.env')
  if (!existsSync(ruta)) return
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m || m[1] in process.env) continue
    let valor = m[2]
    if (/^(['"]).*\1$/.test(valor)) valor = valor.slice(1, -1)
    else valor = valor.replace(/\s+#.*$/, '')
    process.env[m[1]] = valor
  }
}

/** URL, anon key y clave de carga; corta el proceso si falta alguna. */
export function entorno() {
  cargarDotEnv()
  const e = process.env
  const conf = {
    url: (e.SUPABASE_URL || e.VITE_SUPABASE_URL || '').replace(/\/+$/, ''),
    anonKey: e.SUPABASE_ANON_KEY || e.VITE_SUPABASE_ANON_KEY || '',
    clave: e.FLUX_CLAVE_CARGA || '',
  }
  const faltan = [
    !conf.url && 'SUPABASE_URL',
    !conf.anonKey && 'SUPABASE_ANON_KEY',
    !conf.clave && 'FLUX_CLAVE_CARGA',
  ].filter(Boolean)
  if (faltan.length) {
    console.error(`Faltan variables: ${faltan.join(', ')} (en el entorno o en .env).`)
    process.exit(1)
  }
  return conf
}

/** POST {url}/rest/v1/rpc/{funcion}; devuelve el JSON o lanza con el mensaje de PostgREST. */
export async function rpc({ url, anonKey }, funcion, cuerpo) {
  const r = await fetch(`${url}/rest/v1/rpc/${funcion}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(cuerpo),
  })
  const texto = await r.text()
  let datos
  try {
    datos = texto ? JSON.parse(texto) : null
  } catch {
    datos = texto
  }
  if (!r.ok) {
    const msg = (datos && (datos.message || datos.error)) || texto || r.statusText
    throw new Error(`${funcion} respondió ${r.status}: ${msg}${datos?.hint ? ` (${datos.hint})` : ''}`)
  }
  return datos
}
