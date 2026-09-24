// Carga automática de prospectos "para revisar".
//
// Uso:  node scripts/cargar-auto.mjs <archivo.json>
//       (npm run cargar-auto -- <archivo.json>)
//
// Variables (entorno o .env): SUPABASE_URL, SUPABASE_ANON_KEY (o VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY) y FLUX_CLAVE_CARGA.
//
// El archivo puede ser {prospectos:[...]} (formato de data/tanda-2.json) o un array.
// Llama a la RPC cargar_prospectos_auto en lotes de hasta 25; los prospectos entran
// con revisar = true y no tocan empresas ya existentes.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { entorno, rpc } from './rpc-carga.mjs'

const LOTE_MAXIMO = 25

const archivo = process.argv[2]
if (!archivo) {
  console.error('Uso: node scripts/cargar-auto.mjs <archivo.json>')
  process.exit(1)
}

let items
try {
  const json = JSON.parse(readFileSync(resolve(process.cwd(), archivo), 'utf8'))
  items = Array.isArray(json) ? json : json?.prospectos
} catch (e) {
  console.error(`No se pudo leer ${archivo}: ${e.message}`)
  process.exit(1)
}
if (!Array.isArray(items)) {
  console.error('El archivo tiene que ser un array o un objeto con "prospectos": [...]')
  process.exit(1)
}
if (!items.length) {
  console.log('No hay prospectos para cargar.')
  process.exit(0)
}

const conf = entorno()
const total = { insertados: 0, omitidos: [], rechazados: [] }
try {
  for (let i = 0; i < items.length; i += LOTE_MAXIMO) {
    const r = await rpc(conf, 'cargar_prospectos_auto', { clave: conf.clave, lote: items.slice(i, i + LOTE_MAXIMO) })
    total.insertados += r.insertados || 0
    total.omitidos.push(...(r.omitidos || []))
    total.rechazados.push(...(r.rechazados || []))
  }
} catch (e) {
  console.error(`Error: ${e.message}`)
  if (total.insertados) console.error(`(antes del error se insertaron ${total.insertados})`)
  process.exit(1)
}

console.log(`Archivo: ${archivo} · ${items.length} items`)
console.log(`  Insertados (para revisar): ${total.insertados}`)
console.log(`  Omitidos:                  ${total.omitidos.length}`)
for (const o of total.omitidos) console.log(`    - ${o.empresa ?? '(sin nombre)'}: ${o.motivo}`)
console.log(`  Rechazados:                ${total.rechazados.length}`)
for (const o of total.rechazados) console.log(`    - ${o.empresa ?? '(sin nombre)'}: ${o.motivo}`)
console.log(JSON.stringify(total))
if (total.rechazados.length) process.exitCode = 2
