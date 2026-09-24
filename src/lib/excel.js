import { supabase, ok, traerTodo } from './supabase'
import { ESTADOS, PAIS_POR_DEFECTO, SEGMENTOS, VERIFICACIONES } from './constantes'

/** Columnas de exportación/importación (encabezado = nombre de columna). */
export const COLUMNAS = [
  ['empresa', (p) => p.empresas?.nombre],
  ['segmento', (p) => p.empresas?.segmento],
  ['pais', (p) => p.empresas?.pais],
  ['web', (p) => p.empresas?.web],
  ['region', (p) => p.empresas?.region],
  ['tamano', (p) => p.empresas?.tamano],
  ['score_fit', (p) => p.empresas?.score_fit],
  ['nombre', (p) => p.nombre],
  ['apellido', (p) => p.apellido],
  ['cargo', (p) => p.cargo],
  ['url_linkedin', (p) => p.url_linkedin],
  ['link_busqueda', (p) => p.link_busqueda],
  ['verificacion', (p) => p.verificacion],
  ['estado', (p) => p.estado],
  ['proximo_toque', (p) => p.proximo_toque],
  ['ultimo_contacto', (p) => p.ultimo_contacto],
  ['gancho', (p) => p.gancho],
  ['msg_invitacion', (p) => p.msg_invitacion],
  ['msg_1', (p) => p.msg_1],
  ['msg_followup', (p) => p.msg_followup],
  ['msg_cierre', (p) => p.msg_cierre],
  ['notas', (p) => p.notas],
  ['fuente', (p) => p.fuente],
]

// SheetJS pesa: se carga solo al importar/exportar.
const cargarXlsx = () => import('xlsx')

export async function exportar(prospectos, formato = 'xlsx') {
  const XLSX = await cargarXlsx()
  const filas = prospectos.map((p) => Object.fromEntries(COLUMNAS.map(([c, f]) => [c, f(p) ?? ''])))
  const hoja = XLSX.utils.json_to_sheet(filas, { header: COLUMNAS.map(([c]) => c) })
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Prospectos')
  const fecha = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(libro, `flux-prospectos-${fecha}.${formato}`, { bookType: formato === 'csv' ? 'csv' : 'xlsx' })
}

const normalizar = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')

const ALIAS = {
  empresa: 'empresa',
  compania: 'empresa',
  company: 'empresa',
  tamaño: 'tamano',
  tamano: 'tamano',
  score: 'score_fit',
  linkedin: 'url_linkedin',
  url: 'url_linkedin',
  mensaje_1: 'msg_1',
  invitacion: 'msg_invitacion',
  followup: 'msg_followup',
  follow_up: 'msg_followup',
  cierre: 'msg_cierre',
  region: 'region',
  pais: 'pais',
}

const vacioANull = (v) => {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Score 1-100 o null si viene vacío o no es número. */
const aScore = (v) => {
  if (v == null || String(v).trim() === '') return null
  const n = Math.round(Number(v))
  return Number.isNaN(n) ? null : Math.max(1, Math.min(100, n))
}

const buscarEnum =(valor, opciones) => {
  const n = normalizar(valor)
  return opciones.find((o) => normalizar(o) === n) || null
}

/** Lee un .xlsx/.csv y devuelve filas normalizadas. */
export async function leerArchivo(archivo) {
  const XLSX = await cargarXlsx()
  const buffer = await archivo.arrayBuffer()
  const libro = XLSX.read(buffer, { type: 'array' })
  const hoja = libro.Sheets[libro.SheetNames[0]]
  const crudas = XLSX.utils.sheet_to_json(hoja, { defval: '' })
  return crudas.map((fila) => {
    const r = {}
    for (const [k, v] of Object.entries(fila)) {
      const n = normalizar(k)
      r[ALIAS[n] || n] = v
    }
    return r
  })
}

const clavePersona = (empresaId, p) =>
  [empresaId, p.nombre, p.apellido, p.cargo].map((x) => (x || '').trim().toLowerCase()).join('|')

/**
 * Importa filas: crea/actualiza empresas por nombre y agrega prospectos
 * sin duplicar (misma empresa + nombre + apellido + cargo).
 */
export async function importarFilas(filas) {
  const resultado = { empresasNuevas: 0, prospectosNuevos: 0, duplicados: 0, errores: [] }
  const empresas = await traerTodo(() => supabase.from('empresas').select('id, nombre').order('id'))
  const porNombre = new Map(empresas.map((e) => [e.nombre.trim().toLowerCase(), e]))
  const existentes = await traerTodo(() =>
    supabase.from('prospectos').select('empresa_id, nombre, apellido, cargo').order('id'),
  )
  const vistos = new Set(existentes.map((p) => clavePersona(p.empresa_id, p)))

  for (const [i, f] of filas.entries()) {
    const nFila = i + 2 // +1 por encabezado, +1 por base 1
    try {
      const nombreEmpresa = vacioANull(f.empresa)
      if (!nombreEmpresa) throw new Error('falta la columna empresa')
      const datosEmpresa = {
        segmento: buscarEnum(f.segmento, SEGMENTOS),
        pais: vacioANull(f.pais) || PAIS_POR_DEFECTO,
        web: vacioANull(f.web),
        region: vacioANull(f.region),
        tamano: vacioANull(f.tamano),
        score_fit: aScore(f.score_fit),
      }
      let empresa = porNombre.get(nombreEmpresa.toLowerCase())
      if (!empresa) {
        empresa = ok(await supabase.from('empresas').insert({ nombre: nombreEmpresa, ...datosEmpresa }).select('id, nombre').single())
        porNombre.set(nombreEmpresa.toLowerCase(), empresa)
        resultado.empresasNuevas += 1
      } else {
        const cambios = Object.fromEntries(Object.entries(datosEmpresa).filter(([, v]) => v != null))
        if (Object.keys(cambios).length) ok(await supabase.from('empresas').update(cambios).eq('id', empresa.id))
      }

      const persona = {
        empresa_id: empresa.id,
        nombre: vacioANull(f.nombre),
        apellido: vacioANull(f.apellido),
        cargo: vacioANull(f.cargo),
        url_linkedin: vacioANull(f.url_linkedin),
        link_busqueda: vacioANull(f.link_busqueda),
        verificacion: buscarEnum(f.verificacion, VERIFICACIONES) || 'Por verificar',
        estado: buscarEnum(f.estado, ESTADOS) || 'Por invitar',
        gancho: vacioANull(f.gancho),
        msg_invitacion: vacioANull(f.msg_invitacion),
        msg_1: vacioANull(f.msg_1),
        msg_followup: vacioANull(f.msg_followup),
        msg_cierre: vacioANull(f.msg_cierre),
        notas: vacioANull(f.notas),
        fuente: vacioANull(f.fuente),
      }
      const clave = clavePersona(empresa.id, persona)
      if (vistos.has(clave)) {
        resultado.duplicados += 1
        continue
      }
      ok(await supabase.from('prospectos').insert(persona))
      vistos.add(clave)
      resultado.prospectosNuevos += 1
    } catch (e) {
      resultado.errores.push(`Fila ${nFila}: ${e.message}`)
    }
  }
  return resultado
}
