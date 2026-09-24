import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { supabase, traerTodo } from '../lib/supabase'
import { SELECT_PROSPECTO, moverEstado } from '../lib/acciones'
import { COLOR_ESTADO, ESTADOS, SEGMENTOS } from '../lib/constantes'
import { nombreCompleto } from '../lib/mensajes'
import { formatoFecha, hoyIso } from '../lib/fechas'
import { useToast } from '../components/Toast'
import { Cargando, ErrorCaja, ScoreBadge, VerificacionBadge } from '../components/Insignias'

export default function Pipeline() {
  const avisar = useToast()
  const [prospectos, setProspectos] = useState(null)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [segmento, setSegmento] = useState('')
  const [ocultarCerrados, setOcultarCerrados] = useState(false)
  const [arrastrando, setArrastrando] = useState(null)

  // Mouse: arrastra al moverse 6px. Touch: mantener apretado 250ms (así el scroll sigue andando).
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  useEffect(() => {
    traerTodo(() => supabase.from('prospectos').select(SELECT_PROSPECTO).order('actualizado_en', { ascending: false }).order('id'))
      .then(setProspectos)
      .catch((e) => setError(e.message))
  }, [])

  const filtrados = useMemo(() => {
    if (!prospectos) return []
    const q = busqueda.trim().toLowerCase()
    return prospectos.filter(
      (p) =>
        (!segmento || p.empresas?.segmento === segmento) &&
        (!q || `${p.empresas?.nombre} ${p.nombre} ${p.apellido} ${p.cargo}`.toLowerCase().includes(q)),
    )
  }, [prospectos, busqueda, segmento])

  const columnas = ocultarCerrados ? ESTADOS.filter((e) => !['Cliente', 'No interesado', 'Cierre enviado'].includes(e)) : ESTADOS

  async function mover(prospecto, estadoNuevo) {
    if (!prospecto || prospecto.estado === estadoNuevo) return
    const anterior = prospecto
    setProspectos((ps) => ps.map((p) => (p.id === prospecto.id ? { ...p, estado: estadoNuevo } : p)))
    try {
      const actualizado = await moverEstado(prospecto, estadoNuevo)
      setProspectos((ps) => ps.map((p) => (p.id === actualizado.id ? actualizado : p)))
      avisar(`${prospecto.empresas?.nombre || nombreCompleto(prospecto)} → ${estadoNuevo}`)
    } catch (e) {
      setProspectos((ps) => ps.map((p) => (p.id === anterior.id ? anterior : p)))
      avisar(`No se pudo mover: ${e.message}`, 'error')
    }
  }

  function alSoltar({ active, over }) {
    setArrastrando(null)
    if (!over) return
    mover(prospectos.find((p) => p.id === active.id), over.id)
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Pipeline</h1>
          <p className="text-sm text-slate-400">
            Arrastrá las tarjetas entre etapas (en el celular, mantené apretado). Cada movimiento queda registrado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-48"
            placeholder="Buscar…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <select className="input w-auto" value={segmento} onChange={(e) => setSegmento(e.target.value)}>
            <option value="">Todos los segmentos</option>
            {SEGMENTOS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={ocultarCerrados}
              onChange={(e) => setOcultarCerrados(e.target.checked)}
              className="accent-flux-500"
            />
            Ocultar cerrados
          </label>
        </div>
      </header>

      <ErrorCaja error={error} />
      {!prospectos && !error && <Cargando />}

      {prospectos && (
        <DndContext
          sensors={sensores}
          onDragStart={({ active }) => setArrastrando(prospectos.find((p) => p.id === active.id))}
          onDragCancel={() => setArrastrando(null)}
          onDragEnd={alSoltar}
        >
          <div className="scroll-fino -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
            {columnas.map((estado) => (
              <Columna
                key={estado}
                estado={estado}
                prospectos={filtrados.filter((p) => p.estado === estado)}
                onMover={mover}
              />
            ))}
          </div>
          <DragOverlay>{arrastrando ? <Tarjeta prospecto={arrastrando} flotando /> : null}</DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

function Columna({ estado, prospectos, onMover }) {
  const { setNodeRef, isOver } = useDroppable({ id: estado })
  return (
    <section
      ref={setNodeRef}
      className={`glass flex w-[260px] shrink-0 flex-col p-2.5 transition ${isOver ? 'border-flux-400/70 bg-flux-500/10' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className={`chip ${COLOR_ESTADO[estado]}`}>{estado}</span>
        <span className="text-xs tabular-nums text-slate-500">{prospectos.length}</span>
      </div>
      <div className="scroll-fino flex max-h-[68vh] min-h-[120px] flex-col gap-2 overflow-y-auto">
        {prospectos.map((p) => (
          <TarjetaArrastrable key={p.id} prospecto={p} onMover={onMover} />
        ))}
      </div>
    </section>
  )
}

function TarjetaArrastrable({ prospecto, onMover }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: prospecto.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ touchAction: 'manipulation' }}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
    >
      <Tarjeta prospecto={prospecto} onMover={onMover} />
    </div>
  )
}

// Evita que el link o el selector disparen el arrastre.
const frenar = (e) => e.stopPropagation()
const sinArrastre = { onMouseDown: frenar, onTouchStart: frenar }

function Tarjeta({ prospecto, onMover, flotando }) {
  const vencido = prospecto.proximo_toque && prospecto.proximo_toque < hoyIso()
  return (
    <div
      className={`rounded-xl border border-white/10 bg-[#1b1526]/90 p-2.5 text-sm ${
        flotando ? 'rotate-2 shadow-2xl shadow-flux-900/60 ring-1 ring-flux-400' : ''
      }`}
    >
      <Link
        to={`/prospecto/${prospecto.id}`}
        className="block truncate font-semibold text-white hover:text-flux-200"
        {...sinArrastre}
      >
        {prospecto.empresas?.nombre || 'Sin empresa'}
      </Link>
      <p className="truncate text-xs text-slate-400">
        {nombreCompleto(prospecto)}
        {prospecto.cargo ? ` · ${prospecto.cargo}` : ''}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <ScoreBadge score={prospecto.empresas?.score_fit} />
        {prospecto.verificacion !== 'Verificado' && <VerificacionBadge verificacion={prospecto.verificacion} />}
      </div>
      {prospecto.proximo_toque && (
        <p className={`mt-1 text-[11px] ${vencido ? 'text-amber-300' : 'text-slate-500'}`}>
          Próximo toque: {formatoFecha(prospecto.proximo_toque)}
        </p>
      )}
      {onMover && (
        <select
          aria-label="Mover a otra etapa"
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-300"
          value={prospecto.estado}
          {...sinArrastre}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => onMover(prospecto, e.target.value)}
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e === prospecto.estado ? `Mover a… (${e})` : e}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
