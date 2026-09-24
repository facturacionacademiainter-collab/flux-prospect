export const SEGMENTOS = [
  'Fintech de crédito',
  'Financiera',
  'Mutual/Cooperativa',
  'Retail con crédito',
  'Automotor',
  'Billetera con préstamos',
]

export const ESTADOS = [
  'Por invitar',
  'Invitado',
  'Conectado',
  'Mensaje 1',
  'Follow-up',
  'Cierre enviado',
  'Respondió',
  'Llamada hecha',
  'Demo agendada',
  'Demo hecha',
  'Diagnóstico en curso',
  'Propuesta',
  'Cliente',
  'No interesado',
]

export const ESTADOS_CERRADOS = ['Cliente', 'No interesado']

export const VERIFICACIONES = ['Verificado', 'Por verificar', 'Sin perfil']

// 'respuesta', 'aceptación' y 'cambio de estado' los agrega la migración 20260924000001.
export const TIPOS_ACTIVIDAD = [
  'invitación',
  'aceptación',
  'mensaje',
  'follow-up',
  'respuesta',
  'llamada',
  'email',
  'reunión',
  'demo',
  'propuesta',
  'cambio de estado',
]

export const TIPOS_MENSAJE = [
  { valor: 'invitacion', etiqueta: 'Invitación', campo: 'msg_invitacion' },
  { valor: 'mensaje_1', etiqueta: 'Mensaje 1', campo: 'msg_1' },
  { valor: 'followup', etiqueta: 'Follow-up', campo: 'msg_followup' },
  { valor: 'cierre', etiqueta: 'Cierre', campo: 'msg_cierre' },
]

/** LinkedIn corta las notas de invitación en 300 caracteres. */
export const LIMITE_INVITACION = 300

/** Qué mensaje corresponde mandar según el estado actual. */
export const MENSAJE_POR_ESTADO = {
  'Por invitar': 'invitacion',
  Invitado: 'mensaje_1',
  Conectado: 'mensaje_1',
  'Mensaje 1': 'followup',
  'Follow-up': 'cierre',
}

/** "Marcar enviado": estado siguiente y tipo de actividad a registrar. */
export const AVANCE_POR_ENVIO = {
  'Por invitar': { siguiente: 'Invitado', tipo: 'invitación' },
  Conectado: { siguiente: 'Mensaje 1', tipo: 'mensaje' },
  'Mensaje 1': { siguiente: 'Follow-up', tipo: 'follow-up' },
  'Follow-up': { siguiente: 'Cierre enviado', tipo: 'mensaje' },
}

export const CADENCIAS_DEFAULT = {
  Invitado: 7,
  Conectado: 0,
  'Mensaje 1': 4,
  'Follow-up': 6,
  'Cierre enviado': 60,
  Respondió: 1,
}

export const METAS_DEFAULT = { invitaciones: 100, demos: 5 }

export const LIMITE_INVITACIONES_DEFAULT = 25

export const COLOR_ESTADO = {
  'Por invitar': 'bg-slate-500/20 text-slate-200 border-slate-400/30',
  Invitado: 'bg-sky-500/15 text-sky-200 border-sky-400/30',
  Conectado: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30',
  'Mensaje 1': 'bg-indigo-500/15 text-indigo-200 border-indigo-400/30',
  'Follow-up': 'bg-violet-500/15 text-violet-200 border-violet-400/30',
  'Cierre enviado': 'bg-zinc-500/20 text-zinc-300 border-zinc-400/30',
  Respondió: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  'Llamada hecha': 'bg-orange-500/15 text-orange-200 border-orange-400/30',
  'Demo agendada': 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30',
  'Demo hecha': 'bg-pink-500/15 text-pink-200 border-pink-400/30',
  'Diagnóstico en curso': 'bg-flux-500/20 text-flux-100 border-flux-400/40',
  Propuesta: 'bg-teal-500/15 text-teal-200 border-teal-400/30',
  Cliente: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
  'No interesado': 'bg-rose-500/15 text-rose-200 border-rose-400/30',
}

export const COLOR_VERIFICACION = {
  Verificado: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
  'Por verificar': 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  'Sin perfil': 'bg-rose-500/15 text-rose-200 border-rose-400/30',
}

/** Países de Hispanoamérica (código ISO para la insignia), en orden de prioridad comercial. */
export const PAISES = [
  ['Argentina', 'AR'],
  ['México', 'MX'],
  ['Colombia', 'CO'],
  ['Chile', 'CL'],
  ['Perú', 'PE'],
  ['Uruguay', 'UY'],
  ['Paraguay', 'PY'],
  ['Bolivia', 'BO'],
  ['Ecuador', 'EC'],
  ['Venezuela', 'VE'],
  ['Guatemala', 'GT'],
  ['El Salvador', 'SV'],
  ['Honduras', 'HN'],
  ['Nicaragua', 'NI'],
  ['Costa Rica', 'CR'],
  ['Panamá', 'PA'],
  ['República Dominicana', 'DO'],
  ['Puerto Rico', 'PR'],
  ['Cuba', 'CU'],
]
export const PAIS_POR_DEFECTO = 'Argentina'
export const codigoPais = (pais) => PAISES.find(([p]) => p === pais)?.[1] || (pais || '?').slice(0, 2).toUpperCase()
export const paisDe = (p) => p?.empresas?.pais || PAIS_POR_DEFECTO
/** Orden de la lista PAISES; los que no están, al final y alfabéticos. */
export const ordenPais = (a, b) => {
  const ia = PAISES.findIndex(([p]) => p === a)
  const ib = PAISES.findIndex(([p]) => p === b)
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'es')
}
