import { TIPOS_MENSAJE, MENSAJE_POR_ESTADO } from './constantes'

export const campoDeTipo = (tipo) => TIPOS_MENSAJE.find((t) => t.valor === tipo)?.campo
export const etiquetaDeTipo = (tipo) => TIPOS_MENSAJE.find((t) => t.valor === tipo)?.etiqueta ?? tipo

/** Reemplaza {nombre} {empresa} {gancho} en una plantilla. */
export function renderizarPlantilla(cuerpo, { nombre, empresa, gancho } = {}) {
  return (cuerpo || '')
    .replaceAll('{nombre}', nombre || '')
    .replaceAll('{empresa}', empresa || '')
    .replaceAll('{gancho}', gancho || '')
}

export function variablesDe(prospecto) {
  return {
    nombre: prospecto.nombre || '',
    empresa: prospecto.empresas?.nombre || '',
    gancho: prospecto.gancho || '',
  }
}

/** Plantilla más específica para el segmento y tipo (segmento exacto > genérica). */
export function elegirPlantilla(plantillas, tipo, segmento) {
  const delTipo = plantillas.filter((p) => p.tipo === tipo)
  return delTipo.find((p) => p.segmento && p.segmento === segmento) || delTipo.find((p) => !p.segmento) || null
}

/**
 * Mensaje que corresponde al estado del prospecto.
 * Usa el texto propio del prospecto; si está vacío, cae a una plantilla.
 * Devuelve { tipo, texto, plantillaId } o null si el estado no lleva mensaje.
 */
export function mensajeParaEstado(prospecto, plantillas = []) {
  const tipo = MENSAJE_POR_ESTADO[prospecto.estado]
  if (!tipo) return null
  const propio = prospecto[campoDeTipo(tipo)]
  if (propio && propio.trim()) {
    return { tipo, texto: propio, plantillaId: prospecto.plantilla_id || null }
  }
  const plantilla =
    (prospecto.plantilla_id && plantillas.find((p) => p.id === prospecto.plantilla_id && p.tipo === tipo)) ||
    elegirPlantilla(plantillas, tipo, prospecto.empresas?.segmento)
  if (!plantilla) return { tipo, texto: '', plantillaId: null }
  return {
    tipo,
    texto: renderizarPlantilla(plantilla.cuerpo, variablesDe(prospecto)),
    plantillaId: plantilla.id,
  }
}

export function nombreCompleto(p) {
  const n = [p.nombre, p.apellido].filter(Boolean).join(' ')
  return n || 'Contacto sin identificar'
}

export function linkPerfil(p) {
  return p.url_linkedin || p.link_busqueda || null
}

/** Separa el campo fuente ("url ; url ; texto") en partes y detecta las URLs. */
export function partirFuentes(texto) {
  if (!texto) return []
  return texto
    .split(/\s;\s|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/https?:\/\/[^\s)]+/)
      return { texto: s, url: m ? m[0].replace(/[.,;]+$/, '') : null }
    })
}
