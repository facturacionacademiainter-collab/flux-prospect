import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, traerTodo } from '../lib/supabase'
import { useDatosApp } from '../lib/datosApp'
import { SEGMENTOS } from '../lib/constantes'
import { finDiaTs, hoyIso, inicioDiaTs, inicioSemana, sumarDias } from '../lib/fechas'
import {
  METRICAS,
  actividadPorSemana,
  contarAutomatico,
  embudo,
  etiquetaMetrica,
  formatoTasa,
  rendimientoPor,
  sumarAjustes,
  tasa,
} from '../lib/kpis'
import AjusteKpiModal from '../components/AjusteKpiModal'
import GraficoSemanal from '../components/GraficoSemanal'
import { Cargando, ErrorCaja } from '../components/Insignias'

const SIN_PLANTILLA = 'Mensaje personalizado'

function rangoPreset(preset) {
  const hoy = hoyIso()
  if (preset === 'semana') return { desde: inicioSemana(hoy), hasta: hoy }
  if (preset === '4s') return { desde: inicioSemana(sumarDias(hoy, -21)), hasta: hoy }
  if (preset === '90d') return { desde: sumarDias(hoy, -89), hasta: hoy }
  return { desde: '2025-01-01', hasta: hoy }
}

export default function Dashboard() {
  const { config, plantillas } = useDatosApp()
  const [rango, setRango] = useState(() => rangoPreset('4s'))
  const [preset, setPreset] = useState('4s')
  const [segmento, setSegmento] = useState('')
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(null)

  const hoy = hoyIso()
  const lunes = inicioSemana(hoy)
  const domingo = sumarDias(lunes, 6)

  const cargar = useCallback(async () => {
    try {
      const selectAct = 'id, tipo, fecha, estado_nuevo, plantilla_id, prospecto_id, prospectos(plantilla_id, empresas(segmento))'
      const [actividades, prospectos, ajustes, actSemana, ajustesSemana] = await Promise.all([
        traerTodo(() =>
          supabase
            .from('actividades')
            .select(selectAct)
            .gte('fecha', inicioDiaTs(rango.desde))
            .lt('fecha', finDiaTs(rango.hasta))
            .order('fecha')
            .order('id'),
        ),
        traerTodo(() => supabase.from('prospectos').select('id, estado, empresas(segmento)').eq('revisar', false).order('id')),
        traerTodo(() =>
          supabase.from('kpi_ajustes').select('*').gte('desde', rango.desde).lte('hasta', rango.hasta).order('creado_en'),
        ),
        traerTodo(() =>
          supabase
            .from('actividades')
            .select('id, tipo, estado_nuevo, fecha')
            .gte('fecha', inicioDiaTs(lunes))
            .lt('fecha', finDiaTs(domingo))
            .order('id'),
        ),
        traerTodo(() => supabase.from('kpi_ajustes').select('*').gte('desde', lunes).lte('hasta', domingo).order('id')),
      ])
      setDatos({ actividades, prospectos, ajustes, actSemana, ajustesSemana })
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [rango, lunes, domingo])

  useEffect(() => {
    cargar()
  }, [cargar])

  const calculo = useMemo(() => {
    if (!datos) return null
    const segDe = (a) => a.prospectos?.empresas?.segmento
    const acts = segmento ? datos.actividades.filter((a) => segDe(a) === segmento) : datos.actividades
    const pros = segmento ? datos.prospectos.filter((p) => p.empresas?.segmento === segmento) : datos.prospectos
    const auto = contarAutomatico(acts)
    const ajuste = sumarAjustes(datos.ajustes, segmento)
    const total = Object.fromEntries(METRICAS.map((m) => [m.clave, auto[m.clave] + ajuste[m.clave]]))

    const nombrePlantilla = Object.fromEntries(plantillas.map((p) => [p.id, p.nombre]))
    const porPlantilla = rendimientoPor(acts, (a) => {
      const id = a.plantilla_id || a.prospectos?.plantilla_id
      return id ? nombrePlantilla[id] || 'Plantilla borrada' : SIN_PLANTILLA
    })

    const autoSemana = contarAutomatico(datos.actSemana)
    const ajusteSemana = sumarAjustes(datos.ajustesSemana, '')
    return {
      auto,
      ajuste,
      total,
      semanas: actividadPorSemana(acts, rango.desde, rango.hasta),
      embudo: embudo(pros),
      porSegmento: rendimientoPor(acts, segDe).sort((a, b) => SEGMENTOS.indexOf(a.grupo) - SEGMENTOS.indexOf(b.grupo)),
      porPlantilla: porPlantilla.sort((a, b) => b.invitaciones + b.mensajes - (a.invitaciones + a.mensajes)),
      semana: Object.fromEntries(METRICAS.map((m) => [m.clave, autoSemana[m.clave] + ajusteSemana[m.clave]])),
    }
  }, [datos, segmento, plantillas, rango])

  function elegirPreset(p) {
    setPreset(p)
    setRango(rangoPreset(p))
  }

  const metas = Object.entries(config?.metas_semanales || {})

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="titulo-pagina">KPIs</h1>
        <div className="glass flex flex-wrap items-end gap-3 p-3">
          <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            {[
              ['semana', 'Esta semana'],
              ['4s', '4 semanas'],
              ['90d', '90 días'],
              ['todo', 'Todo'],
            ].map(([id, t]) => (
              <button
                key={id}
                onClick={() => elegirPreset(id)}
                className={`btn btn-chico ${preset === id ? 'bg-flux-500 text-white' : 'text-slate-300 hover:bg-white/5'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="kpi-desde">
              Desde
            </label>
            <input
              id="kpi-desde"
              type="date"
              className="input"
              value={rango.desde}
              max={rango.hasta}
              onChange={(e) => {
                setPreset('')
                setRango((r) => ({ ...r, desde: e.target.value || r.desde }))
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="kpi-hasta">
              Hasta
            </label>
            <input
              id="kpi-hasta"
              type="date"
              className="input"
              value={rango.hasta}
              min={rango.desde}
              onChange={(e) => {
                setPreset('')
                setRango((r) => ({ ...r, hasta: e.target.value || r.hasta }))
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="kpi-seg">
              Segmento
            </label>
            <select id="kpi-seg" className="input" value={segmento} onChange={(e) => setSegmento(e.target.value)}>
              <option value="">Todos</option>
              {SEGMENTOS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <ErrorCaja error={error} />
      {!calculo && !error && <Cargando />}

      {calculo && (
        <>
          {metas.length > 0 && (
            <section className="glass p-4 md:p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Metas de esta semana
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {metas.map(([clave, meta]) => {
                  const valor = calculo.semana[clave] ?? 0
                  const pct = meta > 0 ? Math.min(100, (valor / meta) * 100) : 0
                  return (
                    <div key={clave}>
                      <div className="mb-1.5 flex items-baseline justify-between text-sm">
                        <span className="font-semibold text-white">{etiquetaMetrica(clave)}</span>
                        <span className="tabular-nums text-slate-300">
                          {valor} / {meta} <span className="text-slate-500">({Math.round(pct)}%)</span>
                        </span>
                      </div>
                      <div
                        className="h-2.5 overflow-hidden rounded-full bg-white/10"
                        role="progressbar"
                        aria-valuenow={valor}
                        aria-valuemax={meta}
                        aria-label={etiquetaMetrica(clave)}
                      >
                        <div
                          className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-400' : 'bg-flux-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <TarjetaTasa
              titulo="Tasa de aceptación"
              valor={formatoTasa(tasa(calculo.total.aceptaciones, calculo.total.invitaciones))}
              detalle={`${calculo.total.aceptaciones} aceptaciones ÷ ${calculo.total.invitaciones} invitaciones`}
            />
            <TarjetaTasa
              titulo="Tasa de respuesta"
              valor={formatoTasa(tasa(calculo.total.respuestas, calculo.total.aceptaciones))}
              detalle={`${calculo.total.respuestas} respuestas ÷ ${calculo.total.aceptaciones} conexiones`}
            />
            {METRICAS.map((m) => (
              <TarjetaKpi
                key={m.clave}
                titulo={m.etiqueta}
                auto={calculo.auto[m.clave]}
                ajuste={calculo.ajuste[m.clave]}
                onEditar={() => setEditando(m.clave)}
              />
            ))}
          </section>

          <section className="glass p-4 md:p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Actividad por semana</h2>
            <GraficoSemanal datos={calculo.semanas} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="glass p-4 md:p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Embudo por etapa</h2>
              <Embudo filas={calculo.embudo} />
            </div>
            <div className="space-y-4">
              <TablaRendimiento titulo="Rendimiento por segmento" filas={calculo.porSegmento} columnaGrupo="Segmento" />
              <TablaRendimiento titulo="Rendimiento por plantilla" filas={calculo.porPlantilla} columnaGrupo="Plantilla" />
            </div>
          </section>
        </>
      )}

      <AjusteKpiModal
        abierto={Boolean(editando)}
        onCerrar={() => setEditando(null)}
        clave={editando}
        segmento={segmento}
        desde={rango.desde}
        hasta={rango.hasta}
        automatico={editando && calculo ? calculo.auto[editando] : 0}
        ajustes={datos?.ajustes || []}
        onCambio={cargar}
      />
      {segmento && (
        <p className="text-xs text-slate-500">
          Con filtro de segmento, los ajustes manuales se guardan y se muestran solo para {segmento}.
        </p>
      )}
    </div>
  )
}

function TarjetaKpi({ titulo, auto, ajuste, onEditar }) {
  return (
    <div className="glass group relative p-4">
      <p className="pr-8 text-xs font-medium uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-white">{auto + ajuste}</p>
      <p className="mt-0.5 text-xs tabular-nums text-slate-500">
        auto {auto}
        {ajuste !== 0 && (
          <span className="text-flux-300">
            {' '}
            {ajuste > 0 ? '+' : '−'} ajuste {Math.abs(ajuste)}
          </span>
        )}
      </p>
      <button
        className="btn-fantasma btn-chico absolute right-2 top-2"
        onClick={onEditar}
        title="Ajustar a mano"
        aria-label={`Ajustar ${titulo}`}
      >
        ✎
      </button>
    </div>
  )
}

function TarjetaTasa({ titulo, valor, detalle }) {
  return (
    <div className="glass border-flux-400/25 bg-flux-500/10 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-flux-200">{titulo}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-white">{valor}</p>
      <p className="mt-0.5 text-xs text-slate-400">{detalle}</p>
    </div>
  )
}

function Embudo({ filas }) {
  const max = Math.max(1, ...filas.map((f) => f.alcanzaron))
  return (
    <ul className="space-y-1.5">
      {filas.map((f) => (
        <li key={f.estado} className="grid grid-cols-[120px_1fr_auto] items-center gap-2 text-sm sm:grid-cols-[150px_1fr_auto]">
          <span className="truncate text-slate-300" title={f.estado}>
            {f.estado}
          </span>
          <div className="h-5 overflow-hidden rounded-md bg-white/5">
            <div className="h-full rounded-md bg-flux-500/80" style={{ width: `${(f.alcanzaron / max) * 100}%` }} />
          </div>
          <span className="w-20 text-right tabular-nums text-white">
            {f.alcanzaron}
            <span className="text-xs text-slate-500"> ({f.actuales})</span>
          </span>
        </li>
      ))}
      <li className="pt-1 text-xs text-slate-500">
        Barra: prospectos que llegaron al menos a esa etapa. Entre paréntesis: los que están hoy en ella.
      </li>
    </ul>
  )
}

function TablaRendimiento({ titulo, filas, columnaGrupo }) {
  return (
    <div className="glass overflow-hidden">
      <h2 className="px-4 pt-4 text-sm font-semibold uppercase tracking-wide text-slate-400">{titulo}</h2>
      {filas.length === 0 ? (
        <p className="px-4 pb-4 pt-2 text-sm text-slate-500">Sin actividad en el rango.</p>
      ) : (
        <div className="scroll-fino overflow-x-auto p-2">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-2 py-1.5 font-medium">{columnaGrupo}</th>
                <th className="px-2 py-1.5 text-right font-medium">Invit.</th>
                <th className="px-2 py-1.5 text-right font-medium">Acept.</th>
                <th className="px-2 py-1.5 text-right font-medium">Mensajes</th>
                <th className="px-2 py-1.5 text-right font-medium">Resp.</th>
                <th className="px-2 py-1.5 text-right font-medium">% resp.</th>
                <th className="px-2 py-1.5 text-right font-medium">Demos</th>
                <th className="px-2 py-1.5 text-right font-medium">Clientes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filas.map((f) => (
                <tr key={f.grupo} className="tabular-nums text-slate-200">
                  <td className="max-w-[180px] truncate px-2 py-1.5 font-medium text-white" title={f.grupo}>
                    {f.grupo}
                  </td>
                  <td className="px-2 py-1.5 text-right">{f.invitaciones}</td>
                  <td className="px-2 py-1.5 text-right">
                    {f.aceptaciones}{' '}
                    <span className="text-xs text-slate-500">{formatoTasa(tasa(f.aceptaciones, f.invitaciones))}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right">{f.mensajes}</td>
                  <td className="px-2 py-1.5 text-right">{f.respuestas}</td>
                  <td className="px-2 py-1.5 text-right">{formatoTasa(tasa(f.respuestas, f.aceptaciones))}</td>
                  <td className="px-2 py-1.5 text-right">{f.demos}</td>
                  <td className="px-2 py-1.5 text-right">{f.clientes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
