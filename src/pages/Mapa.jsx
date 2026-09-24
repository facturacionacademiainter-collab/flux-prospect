import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, traerTodo } from '../lib/supabase'
import { ESTADOS_CERRADOS, codigoPais, ordenPais, paisDe } from '../lib/constantes'
import { Cargando, ErrorCaja } from '../components/Insignias'
import mapa from '../lib/mapaLatam.json'

// Escala del mapa (cantidad de prospectos por país), de la paleta flux.
const PASOS = [
  { hasta: 2, color: '#4f3668' },
  { hasta: 5, color: '#654584' },
  { hasta: 10, color: '#8C68B1' },
  { hasta: 25, color: '#a283c3' },
  { hasta: Infinity, color: '#d6c6e8' },
]
const colorDe = (n) => PASOS.find((p) => n <= p.hasta).color
const SIN_DATOS = '#241c30'
const CONTEXTO = '#17121f'
const EN_CONVERSACION = ['Respondió', 'Llamada hecha', 'Demo agendada', 'Demo hecha', 'Diagnóstico en curso', 'Propuesta', 'Cliente']

export default function Mapa() {
  const navigate = useNavigate()
  const [prospectos, setProspectos] = useState(null)
  const [error, setError] = useState(null)
  const [encima, setEncima] = useState('')

  useEffect(() => {
    traerTodo(() => supabase.from('prospectos').select('id, estado, revisar, verificacion, empresas(pais)').order('id'))
      .then(setProspectos)
      .catch((e) => setError(e.message))
  }, [])

  const paises = useMemo(() => {
    const m = new Map()
    for (const p of prospectos || []) {
      const k = paisDe(p)
      if (!m.has(k)) m.set(k, { pais: k, total: 0, revisar: 0, activos: 0, conversacion: 0, cerrados: 0 })
      const f = m.get(k)
      f.total += 1
      if (p.revisar) f.revisar += 1
      else if (EN_CONVERSACION.includes(p.estado)) f.conversacion += 1
      else if (ESTADOS_CERRADOS.includes(p.estado)) f.cerrados += 1
      else f.activos += 1
    }
    return [...m.values()].sort((a, b) => ordenPais(a.pais, b.pais))
  }, [prospectos])
  const porPais = useMemo(() => Object.fromEntries(paises.map((p) => [p.pais, p])), [paises])

  const abrir = (pais) => navigate(`/prospectos?pais=${encodeURIComponent(pais)}`)
  const resaltado = porPais[encima]

  return (
    <div className="space-y-5">
      <header>
        <h1 className="titulo-pagina">Mapa</h1>
        <p className="text-sm text-slate-400">
          {prospectos
            ? `${prospectos.length} prospectos en ${paises.length} países. Tocá un país para ver sus prospectos.`
            : '…'}
        </p>
      </header>

      <ErrorCaja error={error} />
      {!prospectos && !error && <Cargando />}

      {prospectos && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section className="glass relative p-3">
            <svg viewBox={`0 0 ${mapa.w} ${mapa.h}`} className="h-auto w-full" role="img" aria-label="Mapa de prospectos por país">
              {mapa.formas.map((f, i) => {
                const datos = f.pais ? porPais[f.pais] : null
                const fill = !f.pais ? CONTEXTO : datos ? colorDe(datos.total) : SIN_DATOS
                return (
                  <path
                    key={i}
                    d={f.d}
                    fill={fill}
                    stroke={encima && f.pais === encima ? '#ffffff' : '#0d0a14'}
                    strokeWidth={encima && f.pais === encima ? 1.6 : 0.7}
                    className={datos ? 'cursor-pointer transition-[filter] hover:brightness-125 focus:outline-none' : ''}
                    tabIndex={datos ? 0 : undefined}
                    role={datos ? 'button' : undefined}
                    aria-label={datos ? `${f.pais}: ${datos.total} prospectos` : undefined}
                    onMouseEnter={() => datos && setEncima(f.pais)}
                    onMouseLeave={() => setEncima('')}
                    onFocus={() => datos && setEncima(f.pais)}
                    onBlur={() => setEncima('')}
                    onClick={() => datos && abrir(f.pais)}
                    onKeyDown={(e) => datos && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), abrir(f.pais))}
                  >
                    {f.pais && <title>{`${f.pais}: ${datos ? `${datos.total} prospectos` : 'sin prospectos'}`}</title>}
                  </path>
                )
              })}
              {/* Una burbuja por país con la cantidad (la primera forma de cada país). */}
              {mapa.formas
                .filter((f, i, todas) => f.pais && porPais[f.pais] && todas.findIndex((x) => x.pais === f.pais) === i)
                .map((f) => {
                  const n = porPais[f.pais].total
                  const r = 8 + Math.min(10, Math.sqrt(n) * 1.6)
                  return (
                    <g key={f.pais} className="cursor-pointer" onClick={() => abrir(f.pais)}>
                      <circle cx={f.cx} cy={f.cy} r={r} fill="#0d0a14" stroke="#d6c6e8" strokeWidth="1.2" />
                      <text
                        x={f.cx}
                        y={f.cy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#ffffff"
                        fontSize="10"
                        fontWeight="700"
                        className="pointer-events-none tabular-nums"
                      >
                        {n}
                      </text>
                    </g>
                  )
                })}
            </svg>
            <div className="flex flex-wrap items-center gap-3 px-2 pb-1 text-xs text-slate-400">
              <span>Prospectos:</span>
              {PASOS.map((p, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: p.color }} />
                  {i === 0 ? '1–2' : p.hasta === Infinity ? `${PASOS[i - 1].hasta + 1}+` : `${PASOS[i - 1].hasta + 1}–${p.hasta}`}
                </span>
              ))}
            </div>
            {resaltado && (
              <div className="glass-strong pointer-events-none absolute left-4 top-4 px-3 py-2 text-sm">
                <p className="font-semibold text-white">{resaltado.pais}</p>
                <p className="text-slate-300">
                  {resaltado.total} prospectos · {resaltado.revisar} para revisar
                </p>
              </div>
            )}
          </section>

          <section className="grid content-start gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {paises.map((p) => (
              <button
                key={p.pais}
                onClick={() => abrir(p.pais)}
                onMouseEnter={() => setEncima(p.pais)}
                onMouseLeave={() => setEncima('')}
                className={`glass flex flex-col gap-2 p-3 text-left transition hover:border-flux-400/50 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-flux-400 ${
                  encima === p.pais ? 'border-flux-400/50' : ''
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="rounded-md bg-flux-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-flux-200">
                    {codigoPais(p.pais)}
                  </span>
                  <span className="flex-1 truncate font-semibold text-white">{p.pais}</span>
                  <span className="text-lg font-bold tabular-nums text-white">{p.total}</span>
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                  {p.revisar > 0 && <span className="text-fuchsia-200">{p.revisar} para revisar</span>}
                  {p.activos > 0 && <span>{p.activos} en seguimiento</span>}
                  {p.conversacion > 0 && <span className="text-emerald-300">{p.conversacion} en conversación</span>}
                  {p.cerrados > 0 && <span>{p.cerrados} cerrados</span>}
                </span>
              </button>
            ))}
          </section>
        </div>
      )}
    </div>
  )
}
