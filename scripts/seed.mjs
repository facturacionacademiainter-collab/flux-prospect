// Carga inicial de Flux Prospect.
//
// Uso:  SEED_EMAIL=... SEED_PASSWORD=... npm run seed
//       (o poné SEED_EMAIL / SEED_PASSWORD en .env)
//
// Entra como ese usuario (signInWithPassword), así RLS y owner_id = auth.uid()
// funcionan solos. Es idempotente: se puede correr varias veces.
//   - empresas: upsert por (owner_id, nombre)
//   - prospectos: no se duplica si ya existe uno con misma empresa + nombre + apellido + cargo
//   - plantillas base: solo si el usuario no tiene ninguna
// NO carga data/tanda-1-grandes.json (empresas descartadas).
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ARCHIVOS = ['data/tanda-1.json', 'data/tanda-2.json']

// --- entorno ---------------------------------------------------------------
const rutaEnv = resolve(raiz, '.env')
if (existsSync(rutaEnv)) {
  // Las variables ya definidas en el entorno tienen prioridad sobre .env.
  process.loadEnvFile(rutaEnv)
}
const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anonKey, SEED_EMAIL: email, SEED_PASSWORD: password } = process.env
const faltan = Object.entries({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anonKey, SEED_EMAIL: email, SEED_PASSWORD: password })
  .filter(([, v]) => !v)
  .map(([k]) => k)
if (faltan.length) {
  console.error(`Faltan variables: ${faltan.join(', ')} (en .env o en el entorno).`)
  process.exit(1)
}

// --- helpers ---------------------------------------------------------------
const vacioANull = (v) => {
  if (v == null) return null
  if (typeof v !== 'string') return v
  const s = v.trim()
  return s === '' ? null : s
}
const clavePersona = (empresaId, p) =>
  [empresaId, p.nombre, p.apellido, p.cargo].map((x) => (x ?? '').trim().toLowerCase()).join('|')

function falla(contexto, error) {
  console.error(`Error ${contexto}: ${error.message}${error.details ? ` (${error.details})` : ''}`)
  process.exit(1)
}

async function traerTodo(construir) {
  const filas = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await construir().range(desde, desde + 999)
    if (error) throw error
    filas.push(...data)
    if (data.length < 1000) return filas
  }
}

const PLANTILLAS_BASE = [
  {
    nombre: 'Invitación base',
    tipo: 'invitacion',
    cuerpo:
      'Hola {nombre}, soy Mauro Alegre. Vengo de liderar cobranzas en Cuotitas y Banco Columbia y me interesa mucho cómo se gestiona la cobranza en {empresa}. ¿Conectamos?',
  },
  {
    nombre: 'Mensaje 1 base',
    tipo: 'mensaje_1',
    cuerpo:
      'Gracias por aceptar, {nombre}. Estuve mirando {empresa} y me quedé con esto: {gancho}\n\nA mí lo que más me costaba en cobranzas era decidir a quién llamar primero cada mañana. Flux Collect resuelve justo eso: para cada cliente estima la chance de pago a 5, 10 y 30 días y sugiere canal y horario. Si te sirve, me pasás un Excel anonimizado y en una semana te devuelvo un diagnóstico de la cartera, gratis.',
  },
  {
    nombre: 'Follow-up base',
    tipo: 'followup',
    cuerpo:
      '{nombre}, un dato que suelo mirar primero: el roll rate de 1-30 a 31-60 días abierto por canal o sucursal. Cuando se abre así, aparecen dos o tres focos que explican buena parte del deterioro. ¿En {empresa} lo siguen así o consolidado?',
  },
  {
    nombre: 'Cierre base',
    tipo: 'cierre',
    cuerpo:
      '{nombre}, no te quiero llenar la bandeja. Si en algún momento querés comparar números de mora con alguien que estuvo del mismo lado del mostrador, acá estoy. ¡Éxitos en {empresa}!',
  },
]

// --- main ------------------------------------------------------------------
const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: login, error: errLogin } = await supabase.auth.signInWithPassword({ email, password })
if (errLogin) falla('al iniciar sesión', errLogin)
const ownerId = login.user.id
console.log(`Sesión iniciada como ${login.user.email}`)

// Configuración: se crea con defaults si no existe (el trigger de próximo toque la usa).
{
  const { error } = await supabase.from('configuracion').upsert(
    {
      owner_id: ownerId,
      cadencias: { Invitado: 7, Conectado: 0, 'Mensaje 1': 4, 'Follow-up': 6, 'Cierre enviado': 60, Respondió: 1 },
      limite_invitaciones_diarias: 25,
      metas_semanales: { invitaciones: 100, demos: 5 },
    },
    { onConflict: 'owner_id', ignoreDuplicates: true },
  )
  if (error) falla('creando la configuración', error)
}

// Lectura de las tandas.
const registros = ARCHIVOS.flatMap((archivo) => {
  const json = JSON.parse(readFileSync(resolve(raiz, archivo), 'utf8'))
  console.log(`${archivo}: ${json.prospectos.length} prospectos`)
  return json.prospectos
})

// Empresas: upsert por (owner_id, nombre).
const empresasPorNombre = new Map()
for (const { empresa: e } of registros) {
  empresasPorNombre.set(e.nombre.trim(), {
    owner_id: ownerId,
    nombre: e.nombre.trim(),
    segmento: vacioANull(e.segmento),
    web: vacioANull(e.web),
    tamano: vacioANull(e.tamano),
    region: vacioANull(e.region),
    analisis: vacioANull(e.analisis),
    score_fit: e.score_fit ?? null,
    score_justificacion: vacioANull(e.score_justificacion),
    noticias: vacioANull(e.noticias),
    fuente: vacioANull(e.fuente),
  })
}
const { data: empresas, error: errEmp } = await supabase
  .from('empresas')
  .upsert([...empresasPorNombre.values()], { onConflict: 'owner_id,nombre' })
  .select('id, nombre')
if (errEmp) falla('cargando empresas', errEmp)
const idEmpresa = new Map(empresas.map((e) => [e.nombre, e.id]))

// Prospectos: idempotentes por empresa + nombre + apellido + cargo.
let existentes
try {
  existentes = await traerTodo(() => supabase.from('prospectos').select('empresa_id, nombre, apellido, cargo').order('id'))
} catch (e) {
  falla('leyendo prospectos', e)
}
const vistos = new Set(existentes.map((p) => clavePersona(p.empresa_id, p)))
const nuevos = []
let salteados = 0
for (const r of registros) {
  const fila = {
    empresa_id: idEmpresa.get(r.empresa.nombre.trim()),
    nombre: vacioANull(r.nombre),
    apellido: vacioANull(r.apellido),
    cargo: vacioANull(r.cargo),
    url_linkedin: vacioANull(r.url_linkedin),
    link_busqueda: vacioANull(r.link_busqueda),
    verificacion: vacioANull(r.verificacion) ?? 'Por verificar',
    fuente: vacioANull(r.fuente),
    gancho: vacioANull(r.gancho),
    msg_invitacion: vacioANull(r.mensajes?.invitacion),
    msg_1: vacioANull(r.mensajes?.mensaje_1),
    msg_followup: vacioANull(r.mensajes?.followup),
    msg_cierre: vacioANull(r.mensajes?.cierre),
  }
  const clave = clavePersona(fila.empresa_id, fila)
  if (vistos.has(clave)) {
    salteados += 1
    continue
  }
  vistos.add(clave)
  nuevos.push(fila)
}
if (nuevos.length) {
  const { error } = await supabase.from('prospectos').insert(nuevos)
  if (error) falla('cargando prospectos', error)
}

// Plantillas base (una por tipo) si no hay ninguna.
const { count: cantPlantillas, error: errCount } = await supabase
  .from('plantillas')
  .select('id', { count: 'exact', head: true })
if (errCount) falla('contando plantillas', errCount)
let plantillasCreadas = 0
if (!cantPlantillas) {
  const { error } = await supabase.from('plantillas').insert(PLANTILLAS_BASE)
  if (error) falla('cargando plantillas', error)
  plantillasCreadas = PLANTILLAS_BASE.length
}

// Conteos finales.
const contar = async (tabla) => {
  const { count, error } = await supabase.from(tabla).select('id', { count: 'exact', head: true })
  if (error) falla(`contando ${tabla}`, error)
  return count
}
const [totalEmpresas, totalProspectos, totalPlantillas] = await Promise.all([
  contar('empresas'),
  contar('prospectos'),
  contar('plantillas'),
])

console.log('\nListo:')
console.log(`  Empresas procesadas (upsert): ${empresas.length}`)
console.log(`  Prospectos nuevos:            ${nuevos.length}`)
console.log(`  Prospectos ya existentes:     ${salteados}`)
console.log(`  Plantillas base creadas:      ${plantillasCreadas}`)
console.log(`  Totales en la base -> empresas: ${totalEmpresas}, prospectos: ${totalProspectos}, plantillas: ${totalPlantillas}`)

await supabase.auth.signOut()
