import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, traerTodo } from '../lib/supabase'
import { SELECT_PROSPECTO, actualizarEmpresa, actualizarProspecto, moverEstado } from '../lib/acciones'
import { ESTADOS, SEGMENTOS, VERIFICACIONES } from '../lib/constantes'
import { formatoFecha, hoyIso } from '../lib/fechas'
import { COLUMNAS, exportar, importarFilas, leerArchivo } from '../lib/excel'
import CeldaEditable from '../components/CeldaEditable'
import AltaProspectoModal from '../components/AltaProspectoModal'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { Cargando, ErrorCaja } from '../components/Insignias'

const COLUMNAS_TABLA = [
  { id: 'empresa', texto: 'Empresa', valor: (p) => p.empresas?.nombre || '' },
  { id: 'segmento', texto: 'Segmento', valor: (p) => p.empresas?.segmento || '' },
  { id: 'score', texto: 'Score', valor: (p) => p.empresas?.score_fit ?? -1 },
  { id: 'nombre', texto: 'Nombre', valor: (p) => p.nombre || '' },
  { id: 'apellido', texto: 'Apellido', valor: (p) => p.apellido || '' },
  { id: 'cargo', texto: 'Cargo', valor: (p) => p.cargo || '' },
  { id: 'estado', texto: 'Estado', valor: (p) => ESTADOS.indexOf(p.estado) },
  { id: 'verificacion', texto: 'Verificación', valor: (p) => VERIFICACIONES.indexOf(p.verificacion) },
  { id: 'proximo', texto: 'Próximo toque', valor: (p) => p.proximo_toque || '9999' },
  { id: 'ultimo', texto: 'Últ. contacto', valor: (p) => p.ultimo_contacto || '' },
]

const FILTROS_VACIOS = { q: '', segmento: '', estado: '', verificacion: '', scoreMin: '', scoreMax: '' }

export default function Prospectos() {
  const avisar = useToast()
  const [prospectos, setProspectos] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [error, setError] = useState(null)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [orden, setOrden] = useState({ col: 'score', asc: false })
  const [alta, setAlta] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState(null)
  const archivoRef = useRef(null)

  async function cargar() {
    try {
      const [ps, es] = await Promise.all([
        traerTodo(() => supabase.from('prospectos').select(SELECT_PROSPECTO).order('creado_en').order('id')),
        traerTodo(() => supabase.from('empresas').select('id, nombre').order('nombre').order('id')),
      ])
      setProspectos(ps)
      setEmpresas(es)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const visibles = useMemo(() => {
    if (!prospectos) return []
    const q = filtros.q.trim().toLowerCase()
    const min = filtros.scoreMin === '' ? null : Number(filtros.scoreMin)
    const max = filtros.scoreMax === '' ? null : Number(filtros.scoreMax)
    const col = COLUMNAS_TABLA.find((c) => c.id === orden.col)
    return prospectos
      .filter((p) => {
        const e = p.empresas || {}
        if (filtros.segmento && e.segmento !== filtros.segmento) return false
        if (filtros.estado && p.estado !== filtros.estado) return false
        if (filtros.verificacion && p.verificacion !== filtros.verificacion) return false
        if (min != null && (e.score_fit ?? -1) < min) return false
        if (max != null && (e.score_fit ?? 999) > max) return false
        if (q) {
          const texto = [e.nombre, e.region, p.nombre, p.apellido, p.cargo, p.gancho, p.notas].join(' ').toLowerCase()
          if (!texto.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        const va = col.valor(a)
        const vb = col.valor(b)
        const r = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es')
        return orden.asc ? r : -r
      })
  }, [prospectos, filtros, orden])

  const reemplazar = (act) => setProspectos((ps) => ps.map((p) => (p.id === act.id ? act : p)))

  async function guardarCampo(p, campo, valor) {
    try {
      const act =
        campo === 'estado' ? await moverEstado(p, valor) : await actualizarProspecto(p.id, { [campo]: valor })
      reemplazar(act)
      avisar('Guardado')
    } catch (e) {
      avisar(`No se pudo guardar: ${e.message}`, 'error')
      throw e
    }
  }

  async function guardarScore(p, valor) {
    try {
      const empresa = await actualizarEmpresa(p.empresa_id, { score_fit: valor })
      setProspectos((ps) => ps.map((x) => (x.empresa_id === empresa.id ? { ...x, empresas: empresa } : x)))
      avisar('Score actualizado')
    } catch (e) {
      avisar(`No se pudo guardar: ${e.message}`, 'error')
      throw e
    }
  }

  async function alElegirArchivo(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setImportando(true)
    try {
      const filas = await leerArchivo(archivo)
      const r = await importarFilas(filas)
      setResultadoImport({ ...r, total: filas.length, archivo: archivo.name })
      await cargar()
    } catch (err) {
      avisar(`No se pudo importar: ${err.message}`, 'error')
    } finally {
      setImportando(false)
    }
  }

  const cambiarFiltro = (k) => (e) => setFiltros((f) => ({ ...f, [k]: e.target.value }))
  const ordenarPor = (col) => setOrden((o) => ({ col, asc: o.col === col ? !o.asc : true }))
  const hoy = hoyIso()

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Prospectos</h1>
          <p className="text-sm text-slate-400">
            {prospectos ? `${visibles.length} de ${prospectos.length}` : '…'} · clic en una celda para editarla
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primario" onClick={() => setAlta(true)}>
            + Nuevo prospecto
          </button>
          <button className="btn-secundario" onClick={() => archivoRef.current?.click()} disabled={importando}>
            {importando ? 'Importando…' : 'Importar Excel/CSV'}
          </button>
          <input
            ref={archivoRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={alElegirArchivo}
          />
          <button className="btn-secundario" onClick={() => exportar(visibles, 'xlsx')} disabled={!visibles.length}>
            Exportar Excel
          </button>
          <button className="btn-secundario" onClick={() => exportar(visibles, 'csv')} disabled={!visibles.length}>
            CSV
          </button>
        </div>
      </header>

      <div className="glass grid grid-cols-2 gap-2 p-3 md:grid-cols-4 xl:grid-cols-7">
        <input
          className="input col-span-2"
          placeholder="Buscar empresa, persona, cargo, región…"
          value={filtros.q}
          onChange={cambiarFiltro('q')}
        />
        <select className="input" value={filtros.segmento} onChange={cambiarFiltro('segmento')} aria-label="Segmento">
          <option value="">Segmento</option>
          {SEGMENTOS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input" value={filtros.estado} onChange={cambiarFiltro('estado')} aria-label="Estado">
          <option value="">Estado</option>
          {ESTADOS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className="input"
          value={filtros.verificacion}
          onChange={cambiarFiltro('verificacion')}
          aria-label="Verificación"
        >
          <option value="">Verificación</option>
          {VERIFICACIONES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <input
            className="input"
            type="number"
            min="1"
            max="100"
            placeholder="Score mín."
            value={filtros.scoreMin}
            onChange={cambiarFiltro('scoreMin')}
            aria-label="Score mínimo"
          />
          <input
            className="input"
            type="number"
            min="1"
            max="100"
            placeholder="máx."
            value={filtros.scoreMax}
            onChange={cambiarFiltro('scoreMax')}
            aria-label="Score máximo"
          />
        </div>
        <button className="btn-fantasma" onClick={() => setFiltros(FILTROS_VACIOS)}>
          Limpiar
        </button>
      </div>

      <ErrorCaja error={error} />
      {!prospectos && !error && <Cargando />}

      {prospectos && (
        <div className="glass overflow-hidden">
          <div className="scroll-fino overflow-x-auto">
            <table className="w-full min-w-[1150px] text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr>
                  {COLUMNAS_TABLA.map((c) => (
                    <th key={c.id} className="px-2 py-2 text-left">
                      <button
                        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-white"
                        onClick={() => ordenarPor(c.id)}
                      >
                        {c.texto}
                        <span className="text-flux-300">{orden.col === c.id ? (orden.asc ? '↑' : '↓') : ''}</span>
                      </button>
                    </th>
                  ))}
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {visibles.map((p) => (
                  <tr key={p.id} className="align-middle hover:bg-white/[0.02]">
                    <td className="max-w-[200px] px-2 py-1">
                      <Link to={`/prospecto/${p.id}`} className="block truncate font-semibold text-white hover:text-flux-200">
                        {p.empresas?.nombre || 'Sin empresa'}
                      </Link>
                    </td>
                    <td className="max-w-[150px] truncate px-2 py-1 text-slate-400">{p.empresas?.segmento || '—'}</td>
                    <td className="w-20 px-1 py-1">
                      <CeldaEditable tipo="number" valor={p.empresas?.score_fit} onGuardar={(v) => guardarScore(p, v)} />
                    </td>
                    <td className="w-32 px-1 py-1">
                      <CeldaEditable valor={p.nombre} onGuardar={(v) => guardarCampo(p, 'nombre', v)} />
                    </td>
                    <td className="w-32 px-1 py-1">
                      <CeldaEditable valor={p.apellido} onGuardar={(v) => guardarCampo(p, 'apellido', v)} />
                    </td>
                    <td className="max-w-[220px] px-1 py-1">
                      <CeldaEditable valor={p.cargo} onGuardar={(v) => guardarCampo(p, 'cargo', v)} />
                    </td>
                    <td className="w-44 px-1 py-1">
                      <CeldaEditable
                        valor={p.estado}
                        opciones={ESTADOS}
                        onGuardar={(v) => guardarCampo(p, 'estado', v)}
                      />
                    </td>
                    <td className="w-36 px-1 py-1">
                      <CeldaEditable
                        valor={p.verificacion}
                        opciones={VERIFICACIONES}
                        onGuardar={(v) => guardarCampo(p, 'verificacion', v)}
                      />
                    </td>
                    <td
                      className={`whitespace-nowrap px-2 py-1 tabular-nums ${
                        p.proximo_toque && p.proximo_toque < hoy ? 'text-amber-300' : 'text-slate-300'
                      }`}
                    >
                      {formatoFecha(p.proximo_toque)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 tabular-nums text-slate-400">
                      {formatoFecha(p.ultimo_contacto)}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Link to={`/prospecto/${p.id}`} className="btn-fantasma btn-chico">
                        Ficha →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibles.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No hay prospectos con esos filtros.</p>}
        </div>
      )}

      <AltaProspectoModal
        abierto={alta}
        onCerrar={() => setAlta(false)}
        empresas={empresas}
        onCreado={() => cargar()}
      />

      <Modal
        abierto={Boolean(resultadoImport)}
        onCerrar={() => setResultadoImport(null)}
        titulo="Resultado de la importación"
        pie={
          <button className="btn-primario" onClick={() => setResultadoImport(null)}>
            Listo
          </button>
        }
      >
        {resultadoImport && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-400">
              {resultadoImport.archivo} · {resultadoImport.total} filas
            </p>
            <ul className="space-y-1 text-slate-200">
              <li>Empresas nuevas: <strong>{resultadoImport.empresasNuevas}</strong></li>
              <li>Prospectos nuevos: <strong>{resultadoImport.prospectosNuevos}</strong></li>
              <li>Duplicados salteados: <strong>{resultadoImport.duplicados}</strong></li>
            </ul>
            {resultadoImport.errores.length > 0 && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-rose-100">
                <p className="mb-1 font-semibold">Errores ({resultadoImport.errores.length})</p>
                <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-xs">
                  {resultadoImport.errores.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Columnas reconocidas: {COLUMNAS.map(([c]) => c).join(', ')}. La única obligatoria es “empresa”.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
