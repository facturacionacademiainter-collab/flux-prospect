import { COLOR_ESTADO, COLOR_VERIFICACION, LIMITE_INVITACION } from '../lib/constantes'

export function EstadoBadge({ estado }) {
  return <span className={`chip ${COLOR_ESTADO[estado] || 'border-white/20 text-slate-300'}`}>{estado}</span>
}

export function VerificacionBadge({ verificacion }) {
  const icono = verificacion === 'Verificado' ? '✓' : verificacion === 'Sin perfil' ? '✕' : '?'
  return (
    <span className={`chip gap-1 ${COLOR_VERIFICACION[verificacion] || ''}`} title="Verificación del perfil">
      <span aria-hidden>{icono}</span>
      {verificacion}
    </span>
  )
}

export function SegmentoBadge({ segmento }) {
  if (!segmento) return null
  return <span className="chip border-white/15 bg-white/5 text-slate-300">{segmento}</span>
}

export function ScoreBadge({ score }) {
  if (score == null) return null
  const color =
    score >= 80
      ? 'border-emerald-400/40 text-emerald-200'
      : score >= 65
        ? 'border-flux-300/40 text-flux-100'
        : 'border-slate-400/30 text-slate-300'
  return (
    <span className={`chip bg-white/5 ${color}`} title="Score de fit">
      Fit {score}
    </span>
  )
}

/** Contador de caracteres en vivo; la invitación se pone roja si pasa 300. */
export function ContadorCaracteres({ texto, esInvitacion }) {
  const n = (texto || '').length
  const excedido = esInvitacion && n > LIMITE_INVITACION
  return (
    <span className={`text-xs tabular-nums ${excedido ? 'font-bold text-rose-400' : 'text-slate-500'}`}>
      {n}
      {esInvitacion ? ` / ${LIMITE_INVITACION}` : ''} caracteres
      {excedido ? ' · supera el límite de LinkedIn' : ''}
    </span>
  )
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-flux-400 border-t-transparent" />
      {texto}
    </div>
  )
}

export function Vacio({ titulo, children }) {
  return (
    <div className="glass px-6 py-12 text-center">
      <p className="text-lg font-semibold text-white">{titulo}</p>
      {children && <div className="mt-2 text-sm text-slate-400">{children}</div>}
    </div>
  )
}

export function ErrorCaja({ error }) {
  if (!error) return null
  return (
    <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
      {typeof error === 'string' ? error : error.message}
    </div>
  )
}
