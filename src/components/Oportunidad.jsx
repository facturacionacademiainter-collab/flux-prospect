import { useEffect, useState } from 'react'
import { useToast } from './Toast'
import { supabase, ok } from '../lib/supabase'
import { ESTADOS } from '../lib/constantes'

/** Oportunidad del prospecto (se usa la más reciente si hubiera varias). */
export default function Oportunidad({ prospecto }) {
  const avisar = useToast()
  const [op, setOp] = useState(null)
  const [form, setForm] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vivo = true
    supabase
      .from('oportunidades')
      .select('*')
      .eq('prospecto_id', prospecto.id)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) avisar(`No se pudo cargar la oportunidad: ${error.message}`, 'error')
        setOp(data || null)
        setForm({
          etapa: data?.etapa || prospecto.estado,
          valor_estimado: data?.valor_estimado ?? '',
          probabilidad: data?.probabilidad ?? '',
          fecha_cierre_estimada: data?.fecha_cierre_estimada || '',
        })
      })
    return () => {
      vivo = false
    }
  }, [prospecto.id])

  if (!form) return null

  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) })

  async function guardar(e) {
    e.preventDefault()
    const prob = form.probabilidad === '' ? null : Number(form.probabilidad)
    if (prob != null && (prob < 0 || prob > 100)) {
      avisar('La probabilidad va de 0 a 100', 'error')
      return
    }
    setGuardando(true)
    try {
      const fila = {
        etapa: form.etapa,
        valor_estimado: form.valor_estimado === '' ? null : Number(form.valor_estimado),
        probabilidad: prob,
        fecha_cierre_estimada: form.fecha_cierre_estimada || null,
      }
      const guardada = op
        ? ok(await supabase.from('oportunidades').update(fila).eq('id', op.id).select().single())
        : ok(await supabase.from('oportunidades').insert({ ...fila, prospecto_id: prospecto.id }).select().single())
      setOp(guardada)
      avisar(op ? 'Oportunidad actualizada' : 'Oportunidad creada')
    } catch (err) {
      avisar(`No se pudo guardar: ${err.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  const ponderado =
    form.valor_estimado !== '' && form.probabilidad !== ''
      ? (Number(form.valor_estimado) * Number(form.probabilidad)) / 100
      : null

  return (
    <form onSubmit={guardar} className="glass space-y-3 p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Oportunidad</h2>
        {!op && <span className="text-xs text-slate-500">Todavía no creada</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="op-etapa">
            Etapa
          </label>
          <select id="op-etapa" className="input" {...campo('etapa')}>
            {ESTADOS.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="op-valor">
            Valor estimado (USD/año)
          </label>
          <input id="op-valor" type="number" min="0" step="0.01" className="input" {...campo('valor_estimado')} />
        </div>
        <div>
          <label className="label" htmlFor="op-prob">
            Probabilidad (%)
          </label>
          <input id="op-prob" type="number" min="0" max="100" className="input" {...campo('probabilidad')} />
        </div>
        <div>
          <label className="label" htmlFor="op-fecha">
            Cierre estimado
          </label>
          <input id="op-fecha" type="date" className="input" {...campo('fecha_cierre_estimada')} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">
          {ponderado != null && `Ponderado: ${ponderado.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
        </span>
        <button className="btn-primario btn-chico" type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : op ? 'Guardar oportunidad' : 'Crear oportunidad'}
        </button>
      </div>
    </form>
  )
}
