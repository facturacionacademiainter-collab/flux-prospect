// Imprime los nombres de las empresas ya cargadas (uno por línea), para
// deduplicar antes de investigar prospectos nuevos.
//
// Uso:  node scripts/nombres-existentes.mjs   (npm run nombres)
// Variables: las mismas que cargar-auto.mjs.
import { entorno, rpc } from './rpc-carga.mjs'

const conf = entorno()
try {
  const nombres = await rpc(conf, 'nombres_empresas_existentes', { clave: conf.clave })
  for (const n of nombres || []) console.log(typeof n === 'string' ? n : Object.values(n)[0])
} catch (e) {
  console.error(`Error: ${e.message}`)
  process.exit(1)
}
