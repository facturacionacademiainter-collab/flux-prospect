import { useEffect, useState } from 'react'
import { supabase, ok } from '../lib/supabase'
import { useDatosApp } from '../lib/datosApp'
import { ESTADOS, SEGMENTOS, TIPOS_MENSAJE } from '../lib/constantes'
import { etiquetaDeTipo } from '../lib/mensajes'
import { METRICAS } from '../lib/kpis'
import PlantillaModal from '../components/PlantillaModal'
import { ConfirmarModal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { Vacio } from '../components/Insignias'

export default function Ajustes() {
  const [pestana, setPestana] = useState('plantillas')
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="titulo-pagina">Plantillas y configuración</h1>
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {[
            ['plantillas', 'Plantillas'],
            ['config', 'Configuración'],
          ].map(([id, t]) => (
            <button
              key={id}
              onClick={() => setPestana(id)}
              className={`btn btn-chico ${pestana === id ? 'bg-flux-500 text-white' : 'text-slate-300 hover:bg-white/5'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>
      {pestana === 'plantillas' ? <Plantillas /> : <Configuracion />}
    </div>
  )
}

function Plantillas() {
  const avisar = useToast()
  const { plantillas, recargarPlantillas } = useDatosApp()
  const [segmento, setSegmento] = useState('')
  const [editando, setEditando] = useState(null) // null | 'nueva' | plantilla
  const [borrando, setBorrando] = useState(null)

  const visibles = plantillas.filter((p) => !segmento || p.segmento === segmento || (segmento === '_generica' && !p.segmento))

  async function guardar(datos) {
    try {
      if (editando && editando !== 'nueva') {
        ok(await supabase.from('plantillas').update(datos).eq('id', editando.id))
      } else {
        ok(await supabase.from('plantillas').insert(datos))
      }
      await recargarPlantillas()
      avisar('Plantilla guardada')
    } catch (e) {
      avisar(`No se pudo guardar: ${e.message}`, 'error')
      throw e
    }
  }

  async function borrar() {
    try {
      ok(await supabase.from('plantillas').delete().eq('id', borrando.id))
      await recargarPlantillas()
      avisar('Plantilla eliminada')
    } catch (e) {
      avisar(`No se pudo borrar: ${e.message}`, 'error')
    } finally {
      setBorrando(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select className="input w-auto" value={segmento} onChange={(e) => setSegmento(e.target.value)}>
          <option value="">Todos los segmentos</option>
          <option value="_generica">Solo genéricas</option>
          {SEGMENTOS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="btn-primario" onClick={() => setEditando('nueva')}>
          + Nueva plantilla
        </button>
      </div>
      <p className="text-sm text-slate-400">
        Las plantillas se usan cuando un prospecto no tiene su mensaje propio para ese paso. Primero se busca una del
        mismo segmento y, si no hay, una genérica. Variables: <code className="text-flux-200">{'{nombre}'}</code>{' '}
        <code className="text-flux-200">{'{empresa}'}</code> <code className="text-flux-200">{'{gancho}'}</code>.
      </p>

      {visibles.length === 0 && <Vacio titulo="No hay plantillas con ese filtro" />}

      {TIPOS_MENSAJE.map((t) => {
        const delTipo = visibles.filter((p) => p.tipo === t.valor)
        if (!delTipo.length) return null
        return (
          <section key={t.valor} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t.etiqueta}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {delTipo.map((p) => (
                <article key={p.id} className="glass flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{p.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {etiquetaDeTipo(p.tipo)} · {p.segmento || 'Genérica'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn-fantasma btn-chico" onClick={() => setEditando(p)}>
                        Editar
                      </button>
                      <button className="btn-fantasma btn-chico text-rose-300" onClick={() => setBorrando(p)}>
                        Borrar
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-slate-300">{p.cuerpo}</p>
                </article>
              ))}
            </div>
          </section>
        )
      })}

      <PlantillaModal
        abierto={Boolean(editando)}
        plantilla={editando === 'nueva' ? null : editando}
        onCerrar={() => setEditando(null)}
        onGuardar={guardar}
      />
      <ConfirmarModal
        abierto={Boolean(borrando)}
        titulo="Borrar plantilla"
        mensaje={`¿Borrar “${borrando?.nombre}”? Las actividades que la usaron quedan, pero sin plantilla asociada.`}
        textoConfirmar="Borrar"
        peligro
        onConfirmar={borrar}
        onCerrar={() => setBorrando(null)}
      />
    </div>
  )
}

// 'Por invitar' no lleva cadencia: el trigger lo deja siempre para hoy.
const ESTADOS_CADENCIA = ESTADOS.filter((e) => e !== 'Por invitar')

function Configuracion() {
  const avisar = useToast()
  const { config, actualizarConfig } = useDatosApp()
  const [limite, setLimite] = useState('')
  const [cadencias, setCadencias] = useState({})
  const [metas, setMetas] = useState({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!config) return
    setLimite(String(config.limite_invitaciones_diarias))
    setCadencias(Object.fromEntries(ESTADOS_CADENCIA.map((e) => [e, config.cadencias?.[e] ?? ''])))
    setMetas(Object.fromEntries(METRICAS.map((m) => [m.clave, config.metas_semanales?.[m.clave] ?? ''])))
  }, [config])

  const limpiar = (obj) =>
    Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== '' && v != null)
        .map(([k, v]) => [k, Math.max(0, Math.round(Number(v)))]),
    )

  async function guardar(e) {
    e.preventDefault()
    const n = Number(limite)
    if (!Number.isFinite(n) || n < 1) {
      avisar('El límite diario tiene que ser 1 o más', 'error')
      return
    }
    setGuardando(true)
    try {
      await actualizarConfig({
        limite_invitaciones_diarias: Math.round(n),
        cadencias: limpiar(cadencias),
        metas_semanales: limpiar(metas),
      })
      avisar('Configuración guardada')
    } catch (err) {
      avisar(`No se pudo guardar: ${err.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-5">
      <section className="glass space-y-3 p-4 md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Límite diario de invitaciones</h2>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            className="input w-28"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            aria-label="Límite diario de invitaciones"
          />
          <p className="text-sm text-slate-400">
            Si lo superás, la pantalla Hoy muestra una alerta. LinkedIn suele restringir cuentas que mandan de más.
          </p>
        </div>
      </section>

      <section className="glass space-y-3 p-4 md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Cadencias (días hasta el próximo toque)</h2>
        <p className="text-sm text-slate-400">
          Al pasar a un estado, el próximo toque queda en hoy + estos días. Vacío = sin próximo toque (no aparece en
          Hoy). “Por invitar” siempre queda para hoy. Los cambios aplican desde el próximo cambio de estado.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ESTADOS_CADENCIA.map((estado) => (
            <div key={estado}>
              <label className="label" htmlFor={`cad-${estado}`}>
                {estado}
              </label>
              <input
                id={`cad-${estado}`}
                type="number"
                min="0"
                className="input"
                placeholder="—"
                value={cadencias[estado] ?? ''}
                onChange={(e) => setCadencias((c) => ({ ...c, [estado]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="glass space-y-3 p-4 md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Metas semanales</h2>
        <p className="text-sm text-slate-400">Vacío = sin meta. Se muestran con barra de progreso en KPIs.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {METRICAS.map((m) => (
            <div key={m.clave}>
              <label className="label" htmlFor={`meta-${m.clave}`}>
                {m.etiqueta}
              </label>
              <input
                id={`meta-${m.clave}`}
                type="number"
                min="0"
                className="input"
                placeholder="—"
                value={metas[m.clave] ?? ''}
                onChange={(e) => setMetas((x) => ({ ...x, [m.clave]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button className="btn-primario" type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </form>
  )
}
