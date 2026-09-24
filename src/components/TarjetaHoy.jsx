import { useState } from 'react'
import { Link } from 'react-router-dom'
import BotonCopiar from './BotonCopiar'
import { useToast } from './Toast'
import { ContadorCaracteres, EstadoBadge, ScoreBadge, SegmentoBadge, VerificacionBadge } from './Insignias'
import { AVANCE_POR_ENVIO, LIMITE_INVITACION } from '../lib/constantes'
import { etiquetaDeTipo, linkPerfil, mensajeParaEstado, nombreCompleto } from '../lib/mensajes'
import { marcarAceptado, marcarEnviado } from '../lib/acciones'
import { diasEntre, hoyIso } from '../lib/fechas'

/** Tarjeta de la cola del día. Nunca envía nada a LinkedIn: copia y abre el perfil. */
export default function TarjetaHoy({ prospecto, plantillas, onActualizado, onRegistrar }) {
  const avisar = useToast()
  const [trabajando, setTrabajando] = useState(false)
  const mensaje = mensajeParaEstado(prospecto, plantillas)
  const avance = AVANCE_POR_ENVIO[prospecto.estado]
  const perfil = linkPerfil(prospecto)
  const atraso = prospecto.proximo_toque ? diasEntre(prospecto.proximo_toque, hoyIso()) : 0
  const esInvitacion = mensaje?.tipo === 'invitacion'
  const excedido = esInvitacion && (mensaje?.texto || '').length > LIMITE_INVITACION

  async function ejecutar(accion, textoOk) {
    setTrabajando(true)
    try {
      const actualizado = await accion()
      avisar(textoOk)
      onActualizado(actualizado)
    } catch (e) {
      avisar(`Algo falló: ${e.message}`, 'error')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <article className={`glass p-4 md:p-5 ${atraso > 0 ? 'border-amber-400/40 ring-1 ring-amber-400/20' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/prospecto/${prospecto.id}`}
            className="block truncate text-base font-bold text-white hover:text-flux-200"
            title="Abrir ficha"
          >
            {prospecto.empresas?.nombre || 'Sin empresa'}
          </Link>
          <p className="text-sm text-slate-300">
            {nombreCompleto(prospecto)}
            {prospecto.cargo && <span className="text-slate-500"> · {prospecto.cargo}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {atraso > 0 && (
            <span className="chip border-amber-400/50 bg-amber-500/20 text-amber-100">
              Atrasado {atraso} {atraso === 1 ? 'día' : 'días'}
            </span>
          )}
          <EstadoBadge estado={prospecto.estado} />
          <VerificacionBadge verificacion={prospecto.verificacion} />
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <SegmentoBadge segmento={prospecto.empresas?.segmento} />
        <ScoreBadge score={prospecto.empresas?.score_fit} />
      </div>

      {mensaje ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-flux-300">
              {etiquetaDeTipo(mensaje.tipo)}
            </span>
            <ContadorCaracteres texto={mensaje.texto} esInvitacion={esInvitacion} />
          </div>
          {mensaje.texto ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{mensaje.texto}</p>
          ) : (
            <p className="text-sm italic text-slate-500">
              No hay mensaje cargado ni plantilla para este paso. Escribilo en la ficha.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          {prospecto.estado === 'Respondió'
            ? 'Respondió: seguí la conversación en LinkedIn y registrá la llamada o demo.'
            : 'Toca seguimiento. Registrá lo que pase.'}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {mensaje?.texto && (
          <BotonCopiar
            texto={mensaje.texto}
            className="btn-secundario"
            aviso={excedido ? 'Copiado, pero la invitación supera los 300 caracteres' : undefined}
          />
        )}
        {perfil ? (
          <a className="btn-secundario" href={perfil} target="_blank" rel="noopener noreferrer">
            Abrir perfil de LinkedIn ↗
          </a>
        ) : (
          <span className="btn-secundario pointer-events-none opacity-50">Sin link de LinkedIn</span>
        )}
        {avance && (
          <button
            className="btn-primario"
            disabled={trabajando}
            onClick={() => ejecutar(() => marcarEnviado(prospecto, plantillas), `Listo: pasó a ${avance.siguiente}`)}
          >
            Marcar enviado
          </button>
        )}
        {prospecto.estado === 'Invitado' && (
          <button
            className="btn-primario"
            disabled={trabajando}
            onClick={() => ejecutar(() => marcarAceptado(prospecto), 'Aceptó: ya podés mandarle el mensaje 1')}
          >
            Aceptó
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/5 pt-2.5">
        <span className="self-center text-xs text-slate-500">Registrar:</span>
        <button className="btn-fantasma btn-chico" onClick={() => onRegistrar(prospecto, 'respuesta')}>
          Respuesta
        </button>
        <button className="btn-fantasma btn-chico" onClick={() => onRegistrar(prospecto, 'llamada')}>
          Llamada
        </button>
        <button className="btn-fantasma btn-chico" onClick={() => onRegistrar(prospecto, 'reunión')}>
          Demo coordinada
        </button>
        <button className="btn-fantasma btn-chico" onClick={() => onRegistrar(prospecto, 'demo')}>
          Demo hecha
        </button>
      </div>
    </article>
  )
}
