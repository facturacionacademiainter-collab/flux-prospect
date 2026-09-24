import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, ok } from '../lib/supabase'
import { useDatosApp } from '../lib/datosApp'
import { SELECT_PROSPECTO, actualizarProspecto, moverEstado } from '../lib/acciones'
import { ESTADOS, VERIFICACIONES } from '../lib/constantes'
import { linkPerfil, nombreCompleto, partirFuentes } from '../lib/mensajes'
import { formatoFecha, formatoFechaHora } from '../lib/fechas'
import { aprobarProspectos, descartarProspecto } from '../lib/revision'
import { ConfirmarModal } from '../components/Modal'
import EditorMensajes from '../components/EditorMensajes'
import Oportunidad from '../components/Oportunidad'
import RegistroModal from '../components/RegistroModal'
import { useToast } from '../components/Toast'
import {
  Cargando,
  ErrorCaja,
  EstadoBadge,
  RevisarBadge,
  ScoreBadge,
  SegmentoBadge,
  VerificacionBadge,
} from '../components/Insignias'

export default function Ficha() {
  const { id } = useParams()
  const avisar = useToast()
  const { plantillas } = useDatosApp()
  const [p, setP] = useState(null)
  const [actividades, setActividades] = useState([])
  const [error, setError] = useState(null)
  const [registro, setRegistro] = useState(false)
  const [confirmarDescarte, setConfirmarDescarte] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const navegar = useNavigate()

  const cargarActividades = useCallback(async () => {
    const data = ok(
      await supabase.from('actividades').select('*').eq('prospecto_id', id).order('fecha', { ascending: false }),
    )
    setActividades(data)
  }, [id])

  useEffect(() => {
    setP(null)
    Promise.all([
      supabase.from('prospectos').select(SELECT_PROSPECTO).eq('id', id).maybeSingle(),
      cargarActividades(),
    ])
      .then(([r]) => {
        if (r.error) throw r.error
        if (!r.data) throw new Error('No encontramos este prospecto.')
        setP(r.data)
      })
      .catch((e) => setError(e.message))
  }, [id, cargarActividades])

  async function alActualizar(act) {
    setP(act)
    await cargarActividades().catch(() => {})
  }

  async function cambiarEstado(estado) {
    try {
      await alActualizar(await moverEstado(p, estado))
      avisar(`Estado: ${estado}`)
    } catch (e) {
      avisar(`No se pudo cambiar: ${e.message}`, 'error')
    }
  }

  async function aprobar() {
    setProcesando(true)
    try {
      const [act] = await aprobarProspectos([p.id])
      if (act) setP(act)
      avisar('Aprobado: ya está en la cola de hoy')
    } catch (e) {
      avisar(`No se pudo aprobar: ${e.message}`, 'error')
    } finally {
      setProcesando(false)
    }
  }

  async function descartar() {
    setConfirmarDescarte(false)
    setProcesando(true)
    try {
      const { empresaBorrada } = await descartarProspecto(p)
      avisar(empresaBorrada ? 'Descartado (y su empresa también)' : 'Descartado')
      navegar('/prospectos')
    } catch (e) {
      avisar(`No se pudo descartar: ${e.message}`, 'error')
      setProcesando(false)
    }
  }

  if (error)
    return (
      <div className="space-y-4">
        <Link to="/prospectos" className="btn-fantasma btn-chico">
          ← Prospectos
        </Link>
        <ErrorCaja error={error} />
      </div>
    )
  if (!p) return <Cargando />

  const e = p.empresas || {}
  const perfil = linkPerfil(p)
  const nombrePlantilla = Object.fromEntries(plantillas.map((x) => [x.id, x.nombre]))

  return (
    <div className="space-y-5">
      <Link to="/prospectos" className="btn-fantasma btn-chico -ml-2">
        ← Prospectos
      </Link>

      {p.revisar && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-4 py-3"
        >
          <div className="text-sm text-fuchsia-50">
            <p className="font-semibold">
              <RevisarBadge origen={p.origen} /> Este prospecto lo cargó la tarea automática.
            </p>
            <p className="mt-0.5 text-fuchsia-100/80">
              Revisá el análisis y los mensajes. Si lo aprobás, entra hoy a la cola; si no, descartalo.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-primario" onClick={aprobar} disabled={procesando}>
              ✓ Aprobar
            </button>
            <button className="btn-peligro" onClick={() => setConfirmarDescarte(true)} disabled={procesando}>
              Descartar
            </button>
          </div>
        </div>
      )}

      <header className="glass flex flex-wrap items-start justify-between gap-4 p-4 md:p-5">
        <div className="min-w-0">
          <h1 className="titulo-pagina truncate">{e.nombre || 'Sin empresa'}</h1>
          <p className="mt-0.5 text-slate-300">
            {nombreCompleto(p)}
            {p.cargo && <span className="text-slate-500"> · {p.cargo}</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <EstadoBadge estado={p.estado} />
            <VerificacionBadge verificacion={p.verificacion} />
            <SegmentoBadge segmento={e.segmento} />
            <ScoreBadge score={e.score_fit} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Próximo toque: {formatoFecha(p.proximo_toque)} · Último contacto: {formatoFecha(p.ultimo_contacto)}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col sm:items-stretch">
          <select
            className="input sm:w-56"
            value={p.estado}
            onChange={(ev) => cambiarEstado(ev.target.value)}
            aria-label="Cambiar estado"
          >
            {ESTADOS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          {perfil && (
            <a className="btn-secundario" href={perfil} target="_blank" rel="noopener noreferrer">
              Abrir perfil de LinkedIn ↗
            </a>
          )}
          <button className="btn-primario" onClick={() => setRegistro(true)}>
            Registrar actividad
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5">
          <AnalisisEmpresa empresa={e} />
          <EditorMensajes prospecto={p} onGuardado={setP} />
        </div>
        <div className="space-y-5">
          <DatosPersona prospecto={p} onGuardado={setP} />
          <Notas prospecto={p} onGuardado={setP} />
          <Oportunidad prospecto={p} />
          <LineaDeTiempo actividades={actividades} nombrePlantilla={nombrePlantilla} />
        </div>
      </div>

      <RegistroModal
        abierto={registro}
        prospecto={p}
        tipoInicial="respuesta"
        onCerrar={() => setRegistro(false)}
        onGuardado={alActualizar}
      />

      <ConfirmarModal
        abierto={confirmarDescarte}
        titulo="Descartar prospecto"
        mensaje={`Se borra ${e.nombre || 'este prospecto'} (y la empresa, si no le quedan otros prospectos). No se puede deshacer.`}
        textoConfirmar="Descartar"
        peligro
        onConfirmar={descartar}
        onCerrar={() => setConfirmarDescarte(false)}
      />
    </div>
  )
}

function Bloque({ titulo, children }) {
  if (!children) return null
  return (
    <div>
      <p className="label">{titulo}</p>
      <div className="whitespace-pre-line text-sm leading-relaxed text-slate-200">{children}</div>
    </div>
  )
}

function Fuentes({ texto }) {
  const partes = partirFuentes(texto)
  if (!partes.length) return null
  return (
    <ul className="space-y-1 text-sm">
      {partes.map((f, i) => (
        <li key={i} className="break-words">
          {f.url ? (
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-flux-300 underline-offset-2 hover:underline">
              {f.texto === f.url ? f.url.replace(/^https?:\/\/(www\.)?/, '') : f.texto}
            </a>
          ) : (
            <span className="text-slate-400">{f.texto}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function AnalisisEmpresa({ empresa: e }) {
  return (
    <section className="glass space-y-4 p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Análisis de la empresa</h2>
        {e.web && (
          <a href={e.web} target="_blank" rel="noopener noreferrer" className="text-sm text-flux-300 hover:underline">
            {e.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} ↗
          </a>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Bloque titulo="Región">{e.region}</Bloque>
        <Bloque titulo="Tamaño">{e.tamano}</Bloque>
      </div>
      <Bloque titulo="Análisis">{e.analisis}</Bloque>
      {e.score_fit != null && (
        <div className="rounded-xl border border-flux-400/25 bg-flux-500/10 p-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold tabular-nums text-white">{e.score_fit}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-flux-500" style={{ width: `${e.score_fit}%` }} />
            </div>
          </div>
          {e.score_justificacion && <p className="mt-2 text-sm text-slate-300">{e.score_justificacion}</p>}
        </div>
      )}
      <Bloque titulo="Noticias">{e.noticias}</Bloque>
      {e.fuente && (
        <div>
          <p className="label">Fuentes</p>
          <Fuentes texto={e.fuente} />
        </div>
      )}
    </section>
  )
}

const CAMPOS_PERSONA = [
  ['nombre', 'Nombre'],
  ['apellido', 'Apellido'],
  ['cargo', 'Cargo'],
  ['url_linkedin', 'URL de LinkedIn'],
  ['link_busqueda', 'Link de búsqueda'],
]

function DatosPersona({ prospecto: p, onGuardado }) {
  const avisar = useToast()
  const inicial = () => ({
    ...Object.fromEntries(CAMPOS_PERSONA.map(([k]) => [k, p[k] || ''])),
    verificacion: p.verificacion,
    gancho: p.gancho || '',
  })
  const [form, setForm] = useState(inicial)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => setForm(inicial()), [p.id])

  const sucio = Object.entries(form).some(([k, v]) => (v || '') !== (p[k] || ''))

  async function guardar(ev) {
    ev.preventDefault()
    setGuardando(true)
    try {
      const cambios = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim?.() === '' ? null : v.trim?.() ?? v]))
      onGuardado(await actualizarProspecto(p.id, cambios))
      avisar('Datos guardados')
    } catch (e) {
      avisar(`No se pudo guardar: ${e.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="glass space-y-3 p-4 md:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Persona</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {CAMPOS_PERSONA.map(([k, t]) => (
          <div key={k} className={k.startsWith('url') || k.startsWith('link') ? 'sm:col-span-2' : ''}>
            <label className="label" htmlFor={`pe-${k}`}>
              {t}
            </label>
            <input
              id={`pe-${k}`}
              className="input"
              value={form[k]}
              onChange={(ev) => setForm((f) => ({ ...f, [k]: ev.target.value }))}
            />
          </div>
        ))}
        <div>
          <label className="label" htmlFor="pe-verif">
            Verificación
          </label>
          <select
            id="pe-verif"
            className="input"
            value={form.verificacion}
            onChange={(ev) => setForm((f) => ({ ...f, verificacion: ev.target.value }))}
          >
            {VERIFICACIONES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="pe-gancho">
            Gancho
          </label>
          <textarea
            id="pe-gancho"
            className="input min-h-[70px]"
            value={form.gancho}
            onChange={(ev) => setForm((f) => ({ ...f, gancho: ev.target.value }))}
          />
        </div>
      </div>
      {p.fuente && (
        <div>
          <p className="label">Fuente del perfil</p>
          <Fuentes texto={p.fuente} />
        </div>
      )}
      <div className="flex justify-end">
        <button className="btn-primario btn-chico" type="submit" disabled={!sucio || guardando}>
          {guardando ? 'Guardando…' : 'Guardar datos'}
        </button>
      </div>
    </form>
  )
}

function Notas({ prospecto: p, onGuardado }) {
  const avisar = useToast()
  const [notas, setNotas] = useState(p.notas || '')
  const [guardando, setGuardando] = useState(false)
  useEffect(() => setNotas(p.notas || ''), [p.id])

  async function guardar() {
    setGuardando(true)
    try {
      onGuardado(await actualizarProspecto(p.id, { notas: notas.trim() || null }))
      avisar('Notas guardadas')
    } catch (e) {
      avisar(`No se pudo guardar: ${e.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="glass space-y-2 p-4 md:p-5">
      <label htmlFor="notas" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Notas
      </label>
      <textarea id="notas" className="input min-h-[110px]" value={notas} onChange={(e) => setNotas(e.target.value)} />
      <div className="flex justify-end">
        <button className="btn-primario btn-chico" onClick={guardar} disabled={guardando || notas === (p.notas || '')}>
          {guardando ? 'Guardando…' : 'Guardar notas'}
        </button>
      </div>
    </section>
  )
}

function LineaDeTiempo({ actividades, nombrePlantilla }) {
  return (
    <section className="glass p-4 md:p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Línea de tiempo</h2>
      {actividades.length === 0 ? (
        <p className="text-sm text-slate-500">Sin actividades todavía.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-white/10 pl-5">
          {actividades.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-flux-400 ring-4 ring-flux-500/20" />
              <p className="text-sm font-semibold capitalize text-white">
                {a.tipo}
                {a.estado_nuevo && (
                  <span className="font-normal normal-case text-slate-400">
                    {' '}
                    · {a.estado_anterior} → {a.estado_nuevo}
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {formatoFechaHora(a.fecha)}
                {a.plantilla_id && ` · plantilla ${nombrePlantilla[a.plantilla_id] || 'borrada'}`}
              </p>
              {a.resultado && <p className="mt-0.5 text-sm text-slate-200">{a.resultado}</p>}
              {a.notas && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-400">{a.notas}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
