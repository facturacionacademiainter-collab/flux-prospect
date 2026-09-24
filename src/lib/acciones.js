import { supabase, ok } from './supabase'
import { AVANCE_POR_ENVIO } from './constantes'
import { mensajeParaEstado } from './mensajes'

export const SELECT_PROSPECTO = '*, empresas(*)'

export async function registrarActividad({
  prospectoId,
  tipo,
  resultado = null,
  notas = null,
  estadoAnterior = null,
  estadoNuevo = null,
  plantillaId = null,
  fecha = null,
}) {
  const fila = {
    prospecto_id: prospectoId,
    tipo,
    resultado: resultado || null,
    notas: notas || null,
    estado_anterior: estadoAnterior,
    estado_nuevo: estadoNuevo,
    plantilla_id: plantillaId,
  }
  if (fecha) fila.fecha = fecha
  return ok(await supabase.from('actividades').insert(fila).select().single())
}

/**
 * Registra una actividad y, si corresponde, cambia el estado del prospecto.
 * Siempre actualiza ultimo_contacto; el trigger recalcula proximo_toque
 * cuando cambia el estado. Devuelve el prospecto actualizado (con empresa).
 */
export async function registrarYActualizar(
  prospecto,
  { tipo, estadoNuevo = null, resultado, notas, plantillaId = null, fecha = null },
) {
  const cambia = Boolean(estadoNuevo && estadoNuevo !== prospecto.estado)
  await registrarActividad({
    prospectoId: prospecto.id,
    tipo,
    resultado,
    notas,
    estadoAnterior: cambia ? prospecto.estado : null,
    estadoNuevo: cambia ? estadoNuevo : null,
    plantillaId,
    fecha,
  })
  const cambios = { ultimo_contacto: fecha || new Date().toISOString() }
  if (cambia) cambios.estado = estadoNuevo
  if (plantillaId && !prospecto.plantilla_id) cambios.plantilla_id = plantillaId
  return ok(
    await supabase.from('prospectos').update(cambios).eq('id', prospecto.id).select(SELECT_PROSPECTO).single(),
  )
}

/** Movimiento manual de estado (kanban, tabla, ficha). */
export function moverEstado(prospecto, estadoNuevo, notas = null) {
  return registrarYActualizar(prospecto, { tipo: 'cambio de estado', estadoNuevo, notas })
}

/** "Marcar enviado": registra el envío del mensaje del estado y avanza. */
export function marcarEnviado(prospecto, plantillas) {
  const avance = AVANCE_POR_ENVIO[prospecto.estado]
  if (!avance) throw new Error(`No hay envío definido para el estado "${prospecto.estado}"`)
  const mensaje = mensajeParaEstado(prospecto, plantillas)
  return registrarYActualizar(prospecto, {
    tipo: avance.tipo,
    estadoNuevo: avance.siguiente,
    plantillaId: mensaje?.plantillaId || null,
  })
}

/** "Aceptó": Invitado -> Conectado. */
export function marcarAceptado(prospecto) {
  return registrarYActualizar(prospecto, {
    tipo: 'aceptación',
    estadoNuevo: 'Conectado',
    resultado: 'Aceptó la invitación',
  })
}

export async function actualizarProspecto(id, cambios) {
  return ok(await supabase.from('prospectos').update(cambios).eq('id', id).select(SELECT_PROSPECTO).single())
}

export async function actualizarEmpresa(id, cambios) {
  return ok(await supabase.from('empresas').update(cambios).eq('id', id).select().single())
}
