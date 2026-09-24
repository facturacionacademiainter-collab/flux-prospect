import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, traerTodo } from '../lib/supabase'
import { useDatosApp } from '../lib/datosApp'
import { SELECT_PROSPECTO } from '../lib/acciones'
import { ESTADOS_CERRADOS, SEGMENTOS, paisDe } from '../lib/constantes'
import { formatoFecha, hoyIso, inicioDiaTs } from '../lib/fechas'
import TarjetaHoy from '../components/TarjetaHoy'
import RegistroModal from '../components/RegistroModal'
import FiltroPais from '../components/FiltroPais'
import { Cargando, ErrorCaja, Vacio } from '../components/Insignias'

const FILTROS = [
  { id: 'todos', texto: 'Todo' },
  { id: 'invitar', texto: 'Invitar', estados: ['Por invitar'] },
  { id: 'seguimiento', texto: 'Seguimiento', estados: ['Invitado', 'Conectado', 'Mensaje 1', 'Follow-up', 'Cierre enviado'] },
  { id: 'conversaciones', texto: 'Conversaciones', excluir: ['Por invitar', 'Invitado', 'Conectado', 'Mensaje 1', 'Follow-up', 'Cierre enviado'] },
]

export default function Hoy() {
  const { config, plantillas } = useDatosApp()
  const [cola, setCola] = useState(null)
  const [invitacionesHoy, setInvitacionesHoy] = useState(0)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [segmento, setSegmento] = useState('')
  const [pais, setPais] = useState('')
  const [registro, setRegistro] = useState(null) // { prospecto, tipo }
  const hoy = hoyIso()
  const limite = config?.limite_invitaciones_diarias ?? 25

  const cargar = useCallback(async () => {
    try {
      const [filas, conteo] = await Promise.all([
        traerTodo(() =>
          supabase
            .from('prospectos')
            .select(SELECT_PROSPECTO)
            .lte('proximo_toque', hoy)
            .eq('revisar', false)
            .not('estado', 'in', `(${ESTADOS_CERRADOS.map((e) => `"${e}"`).join(',')})`)
            .order('proximo_toque', { ascending: true })
            .order('id'),
        ),
        supabase
          .from('actividades')
          .select('id', { count: 'exact', head: true })
          .eq('tipo', 'invitación')
          .gte('fecha', inicioDiaTs(hoy)),
      ])
      if (conteo.error) throw conteo.error
      setCola(filas)
      setInvitacionesHoy(conteo.count || 0)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [hoy])

  useEffect(() => {
    cargar()
  }, [cargar])

  /** Atrasados primero; dentro de cada grupo, por score de fit. */
  const visibles = useMemo(() => {
    if (!cola) return []
    const f = FILTROS.find((x) => x.id === filtro)
    return cola
      .filter((p) => !pais || paisDe(p) === pais)
      .filter((p) => !segmento || p.empresas?.segmento === segmento)
      .filter((p) => (f.estados ? f.estados.includes(p.estado) : f.excluir ? !f.excluir.includes(p.estado) : true))
      .sort((a, b) => {
        const atrA = a.proximo_toque < hoy ? 0 : 1
        const atrB = b.proximo_toque < hoy ? 0 : 1
        if (atrA !== atrB) return atrA - atrB
        if (atrA === 0 && a.proximo_toque !== b.proximo_toque) return a.proximo_toque < b.proximo_toque ? -1 : 1
        return (b.empresas?.score_fit ?? 0) - (a.empresas?.score_fit ?? 0)
      })
  }, [cola, filtro, segmento, pais, hoy])

  function alActualizar(anterior, actualizado) {
    if (anterior.estado === 'Por invitar' && actualizado.estado === 'Invitado') setInvitacionesHoy((n) => n + 1)
    const sigueHoy =
      actualizado.proximo_toque && actualizado.proximo_toque <= hoy && !ESTADOS_CERRADOS.includes(actualizado.estado)
    setCola((c) =>
      sigueHoy ? c.map((p) => (p.id === actualizado.id ? actualizado : p)) : c.filter((p) => p.id !== actualizado.id),
    )
  }

  const atrasados = visibles.filter((p) => p.proximo_toque < hoy).length
  const superado = invitacionesHoy > limite
  const enElLimite = invitacionesHoy === limite

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Hoy</h1>
          <p className="text-sm text-slate-400">
            {formatoFecha(hoy)} · {cola ? `${cola.length} toques pendientes` : '…'}
            {atrasados > 0 && <span className="text-amber-300"> · {atrasados} atrasados</span>}
          </p>
        </div>
        <div className="glass flex items-center gap-3 px-4 py-2.5">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Invitaciones hoy</p>
            <p className={`text-xl font-bold tabular-nums ${superado ? 'text-rose-300' : 'text-white'}`}>
              {invitacionesHoy} <span className="text-sm font-medium text-slate-500">/ {limite}</span>
            </p>
          </div>
          <div className="flex h-10 w-1.5 flex-col justify-end overflow-hidden rounded-full bg-white/10">
            <div
              className={`w-full rounded-full ${superado ? 'bg-rose-400' : 'bg-flux-400'}`}
              style={{ height: `${Math.min(100, (invitacionesHoy / Math.max(limite, 1)) * 100)}%` }}
            />
          </div>
        </div>
      </header>

      {superado && (
        <div role="alert" className="rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
          <strong>Pasaste el límite diario de invitaciones</strong> ({invitacionesHoy} de {limite}). Frená por hoy: LinkedIn
          puede restringir la cuenta si se mandan demasiadas.
        </div>
      )}
      {enElLimite && (
        <div role="status" className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Llegaste al límite de {limite} invitaciones de hoy. Seguí con mensajes y seguimientos.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="scroll-fino flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`btn btn-chico ${filtro === f.id ? 'bg-flux-500 text-white' : 'text-slate-300 hover:bg-white/5'}`}
            >
              {f.texto}
            </button>
          ))}
        </div>
        <select className="input w-auto" value={segmento} onChange={(e) => setSegmento(e.target.value)}>
          <option value="">Todos los segmentos</option>
          {SEGMENTOS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="btn-fantasma btn-chico" onClick={cargar}>
          ↻ Actualizar
        </button>
      </div>

      <FiltroPais prospectos={cola} valor={pais} onCambiar={setPais} />

      <ErrorCaja error={error} />
      {!cola && !error && <Cargando />}
      {cola && visibles.length === 0 && (
        <Vacio titulo="No hay nada pendiente para hoy 🎉">
          Cuando un prospecto tenga su próximo toque vencido, aparece acá.
        </Vacio>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {visibles.map((p) => (
          <TarjetaHoy
            key={p.id}
            prospecto={p}
            plantillas={plantillas}
            onActualizado={(act) => alActualizar(p, act)}
            onRegistrar={(prospecto, tipo) => setRegistro({ prospecto, tipo })}
          />
        ))}
      </div>

      <RegistroModal
        abierto={Boolean(registro)}
        prospecto={registro?.prospecto}
        tipoInicial={registro?.tipo}
        onCerrar={() => setRegistro(null)}
        onGuardado={(act) => alActualizar(registro.prospecto, act)}
      />
    </div>
  )
}
