// Imprime (JSON) los contactos sin confirmar ('Por verificar' o 'Sin perfil') de
// prospectos que todavía están 'Por invitar': lo que la tarea semanal re-investiga.
// Primero los 'Sin perfil', después por score_fit.
//
// Uso:  node scripts/contactos-pendientes.mjs [--max N]   (npm run contactos-pendientes)
// Variables: las mismas que cargar-auto.mjs.
import { entorno, rpc } from './rpc-carga.mjs'

const i = process.argv.indexOf('--max')
const max = i > -1 ? Number(process.argv[i + 1]) : Infinity

const conf = entorno()
try {
  const pendientes = (await rpc(conf, 'contactos_pendientes', { clave: conf.clave })) || []
  console.log(JSON.stringify(pendientes.slice(0, max), null, 2))
  console.error(`${pendientes.length} contactos sin confirmar${Number.isFinite(max) ? ` (se muestran ${Math.min(max, pendientes.length)})` : ''}`)
} catch (e) {
  console.error(`Error: ${e.message}`)
  process.exit(1)
}
