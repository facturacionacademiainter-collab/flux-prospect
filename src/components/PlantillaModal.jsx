import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import { ContadorCaracteres } from './Insignias'
import { SEGMENTOS, TIPOS_MENSAJE } from '../lib/constantes'
import { renderizarPlantilla } from '../lib/mensajes'

const VARIABLES = ['{nombre}', '{empresa}', '{gancho}']

const EJEMPLO = {
  nombre: 'Fulvio',
  empresa: 'Fértil Finanzas',
  gancho: 'gerente de cobranzas de una tarjeta regional con 34 sucursales en el interior bonaerense',
}

const VACIA = { nombre: '', segmento: '', tipo: 'invitacion', cuerpo: '' }

/** Alta/edición de plantilla con variables y vista previa. */
export default function PlantillaModal({ abierto, plantilla, onCerrar, onGuardar }) {
  const [form, setForm] = useState(VACIA)
  const [guardando, setGuardando] = useState(false)
  const cuerpoRef = useRef(null)

  useEffect(() => {
    if (abierto) setForm(plantilla ? { ...VACIA, ...plantilla, segmento: plantilla.segmento || '' } : VACIA)
  }, [abierto, plantilla])

  function insertarVariable(v) {
    const el = cuerpoRef.current
    const ini = el?.selectionStart ?? form.cuerpo.length
    const fin = el?.selectionEnd ?? form.cuerpo.length
    const nuevo = form.cuerpo.slice(0, ini) + v + form.cuerpo.slice(fin)
    setForm((f) => ({ ...f, cuerpo: nuevo }))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(ini + v.length, ini + v.length)
    })
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    try {
      await onGuardar({
        nombre: form.nombre.trim(),
        segmento: form.segmento || null,
        tipo: form.tipo,
        cuerpo: form.cuerpo.trim(),
      })
      onCerrar()
    } catch {
      // el aviso lo muestra quien guarda
    } finally {
      setGuardando(false)
    }
  }

  const vista = renderizarPlantilla(form.cuerpo, EJEMPLO)
  const valida = form.nombre.trim() && form.cuerpo.trim()

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={plantilla ? 'Editar plantilla' : 'Nueva plantilla'}
      ancho="max-w-2xl"
      pie={
        <>
          <button className="btn-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn-primario" type="submit" form="form-plantilla" disabled={!valida || guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="form-plantilla" onSubmit={guardar} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="label" htmlFor="pl-nombre">
              Nombre
            </label>
            <input
              id="pl-nombre"
              className="input"
              required
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="pl-tipo">
              Tipo
            </label>
            <select
              id="pl-tipo"
              className="input"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
            >
              {TIPOS_MENSAJE.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pl-seg">
              Segmento
            </label>
            <select
              id="pl-seg"
              className="input"
              value={form.segmento}
              onChange={(e) => setForm((f) => ({ ...f, segmento: e.target.value }))}
            >
              <option value="">Genérica (todos los segmentos)</option>
              {SEGMENTOS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="label mb-0" htmlFor="pl-cuerpo">
              Texto
            </label>
            <div className="flex gap-1">
              {VARIABLES.map((v) => (
                <button key={v} type="button" className="chip cursor-pointer border-flux-400/40 text-flux-200 hover:bg-flux-500/20" onClick={() => insertarVariable(v)}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <textarea
            id="pl-cuerpo"
            ref={cuerpoRef}
            required
            className="input min-h-[140px] leading-relaxed"
            value={form.cuerpo}
            onChange={(e) => setForm((f) => ({ ...f, cuerpo: e.target.value }))}
          />
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-flux-300">Vista previa</span>
            <ContadorCaracteres texto={vista} esInvitacion={form.tipo === 'invitacion'} />
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
            {vista || <span className="italic text-slate-500">Escribí el texto para ver cómo queda.</span>}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Ejemplo con nombre “{EJEMPLO.nombre}”, empresa “{EJEMPLO.empresa}” y un gancho de muestra.
          </p>
        </div>
      </form>
    </Modal>
  )
}
