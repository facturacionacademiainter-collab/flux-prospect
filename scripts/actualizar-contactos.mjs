// Actualización automática de contactos de prospectos existentes.
//
// Uso:  node scripts/actualizar-contactos.mjs <archivo.json>
//       (npm run actualizar-contactos -- <archivo.json>)
//
// El archivo puede ser {contactos:[...]} o un array. Cada item lleva el "id" que
// devolvió contactos-pendientes y solo los campos que cambian (nombre, apellido,
// cargo, url_linkedin, link_busqueda, verificacion, fuente y, si cambió la persona,
// los cuatro mensajes en "mensajes"). Ver supabase/migrations/20260924000003_actualizar_contactos.sql.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { entorno, rpc } from './rpc-carga.mjs'

const LOTE_MAXIMO = 25

const archivo = process.argv[2]
if (!archivo) {
  console.error('Uso: node scripts/actualizar-contactos.mjs <archivo.json>')
  process.exit(1)
}

let items
try {
  const json = JSON.parse(readFileSync(resolve(process.cwd(), archivo), 'utf8'))
  items = Array.isArray(json) ? json : json?.contactos
} catch (e) {
  console.error(`No se pudo leer ${archivo}: ${e.message}`)
  process.exit(1)
}
if (!Array.isArray(items)) {
  console.error('El archivo tiene que ser un array o un objeto con "contactos": [...]')
  process.exit(1)
}
if (!items.length) {
  console.log('No hay contactos para actualizar.')
  process.exit(0)
}

const conf = entorno()
const total = { actualizados: 0, omitidos: [], rechazados: [] }
try {
  for (let i = 0; i < items.length; i += LOTE_MAXIMO) {
    const r = await rpc(conf, 'actualizar_contactos_auto', { clave: conf.clave, lote: items.slice(i, i + LOTE_MAXIMO) })
    total.actualizados += r.actualizados || 0
    total.omitidos.push(...(r.omitidos || []))
    total.rechazados.push(...(r.rechazados || []))
  }
} catch (e) {
  console.error(`Error: ${e.message}`)
  if (total.actualizados) console.error(`(antes del error se actualizaron ${total.actualizados})`)
  process.exit(1)
}

const etiqueta = (o) => o.empresa ?? o.id ?? '(sin id)'
console.log(`Archivo: ${archivo} · ${items.length} items`)
console.log(`  Actualizados: ${total.actualizados}`)
console.log(`  Omitidos:     ${total.omitidos.length}`)
for (const o of total.omitidos) console.log(`    - ${etiqueta(o)}: ${o.motivo}`)
console.log(`  Rechazados:   ${total.rechazados.length}`)
for (const o of total.rechazados) console.log(`    - ${etiqueta(o)}: ${o.motivo}`)
console.log(JSON.stringify(total))
if (total.rechazados.length) process.exitCode = 2
