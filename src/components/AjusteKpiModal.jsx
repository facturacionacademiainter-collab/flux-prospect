import { useEffect, useState } from 'react'
import Modal from './Modal'
import { useToast } from './Toast'
import { supabase, ok } from '../lib/supabase'
import { claveAjuste, etiquetaMetrica } from '../lib/kpis'
import { formatoFecha } from '../lib/fechas'

/**
 * Ajuste manual de un contador. El ajuste se guarda en kpi_ajustes y se SUMA
 * al valor automático; nunca lo pisa.
 */
export default function AjusteKpiModal({ abierto, onCerrar, clave, segmento, desde, hasta, automatico, ajustes, onCambio }) {
  const avisar = useToast()
  const [valor, setValor] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (abierto) {
      setValor('')
      setNota('')
    }
  }, [abierto, clave])

  if (!clave) return null
  const propios = ajustes.filter((a) => a.metrica === claveAjuste(clave, segmento))
  const sumaAjustes = propios.reduce((s, a) => s + Number(a.valor), 0)
  const total = automatico + sumaAjustes

  async function guardar() {
    const n = Number(valor)
    if (!valor || Number.isNaN(n) || n === 0) {
      avisar('Ingresá un número distinto de cero (puede ser negativo).', 'error')
      return
    }
    setGuardando(true)
    try {
      ok(
        await supabase.from('kpi_ajustes').insert({
          metrica: claveAjuste(clave, segmento),
          desde,
          hasta,
          valor: n,
          nota: nota || null,
        }),
      )
      avisar('Ajuste guardado')
      await onCambio()
      setValor('')
      setNota('')
    } catch (e) {
      avisar(`No se pudo guardar: ${e.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(id) {
    try {
      ok(await supabase.from('kpi_ajustes').delete().eq('id', id))
      avisar('Ajuste eliminado')
      await onCambio()
    } catch (e) {
      avisar(`No se pudo borrar: ${e.message}`, 'error')
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={`Ajustar · ${etiquetaMetrica(clave)}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Dato titulo="Automático" valor={automatico} />
          <Dato titulo="Ajustes" valor={`${sumaAjustes >= 0 ? '+' : ''}${sumaAjustes}`} />
          <Dato titulo="Total" valor={total} destacado />
        </div>
        <p className="text-xs text-slate-400">
          Rango {formatoFecha(desde)} – {formatoFecha(hasta)}
          {segmento ? ` · segmento ${segmento}` : ' · todos los segmentos'}. El ajuste se suma al automático (usá
          negativos para restar).
        </p>
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <div>
            <label className="label" htmlFor="aj-valor">
              Sumar
            </label>
            <input
              id="aj-valor"
              type="number"
              className="input"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="+3 / -1"
            />
          </div>
          <div>
            <label className="label" htmlFor="aj-nota">
              Nota
            </label>
            <input
              id="aj-nota"
              className="input"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej.: invitaciones mandadas desde el celular"
            />
          </div>
        </div>
        <button className="btn-primario w-full" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Agregar ajuste'}
        </button>

        {propios.length > 0 && (
          <div>
            <p className="label">Ajustes en este rango</p>
            <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
              {propios.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    <strong className="tabular-nums text-white">
                      {Number(a.valor) > 0 ? '+' : ''}
                      {Number(a.valor)}
                    </strong>
                    <span className="text-slate-400"> · {a.nota || 'sin nota'}</span>
                    <span className="block text-xs text-slate-500">
                      {formatoFecha(a.desde)} – {formatoFecha(a.hasta)}
                    </span>
                  </span>
                  <button className="btn-fantasma btn-chico text-rose-300" onClick={() => borrar(a.id)}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Dato({ titulo, valor, destacado }) {
  return (
    <div className={`rounded-xl border px-2 py-2.5 ${destacado ? 'border-flux-400/40 bg-flux-500/15' : 'border-white/10 bg-white/5'}`}>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="text-xl font-bold tabular-nums text-white">{valor}</p>
    </div>
  )
}
