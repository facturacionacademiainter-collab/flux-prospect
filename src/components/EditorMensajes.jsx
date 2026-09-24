import { useEffect, useState } from 'react'
import BotonCopiar from './BotonCopiar'
import { ContadorCaracteres } from './Insignias'
import { useToast } from './Toast'
import { TIPOS_MENSAJE, MENSAJE_POR_ESTADO } from '../lib/constantes'
import { supabase } from '../lib/supabase'
import { actualizarProspecto } from '../lib/acciones'

const REGENERAR_HABILITADO = import.meta.env.VITE_ENABLE_REGENERAR === 'true'

/** Los 4 mensajes editables, con contador en vivo y guardado. */
export default function EditorMensajes({ prospecto, onGuardado }) {
  const avisar = useToast()
  const inicial = () => Object.fromEntries(TIPOS_MENSAJE.map((t) => [t.campo, prospecto[t.campo] || '']))
  const [textos, setTextos] = useState(inicial)
  const [guardando, setGuardando] = useState(false)
  const [regenerando, setRegenerando] = useState(null)

  useEffect(() => {
    setTextos(inicial())
  }, [prospecto.id])

  const cambiados = TIPOS_MENSAJE.filter((t) => (textos[t.campo] || '') !== (prospecto[t.campo] || ''))
  const actual = MENSAJE_POR_ESTADO[prospecto.estado]

  async function guardar() {
    setGuardando(true)
    try {
      const cambios = Object.fromEntries(cambiados.map((t) => [t.campo, textos[t.campo].trim() || null]))
      const act = await actualizarProspecto(prospecto.id, cambios)
      onGuardado(act)
      avisar('Mensajes guardados')
    } catch (e) {
      avisar(`No se pudo guardar: ${e.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  async function regenerar(tipo, campo) {
    setRegenerando(tipo)
    try {
      const { data, error } = await supabase.functions.invoke('regenerar-mensaje', {
        body: { prospecto_id: prospecto.id, tipo, actual: textos[campo] },
      })
      if (error) throw error
      if (!data?.texto) throw new Error(data?.error || 'La función no devolvió texto')
      setTextos((t) => ({ ...t, [campo]: data.texto }))
      avisar('Mensaje regenerado: revisalo y guardá')
    } catch (e) {
      avisar(`No se pudo regenerar: ${e.message}`, 'error')
    } finally {
      setRegenerando(null)
    }
  }

  return (
    <section className="glass p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Mensajes</h2>
        <button className="btn-primario btn-chico" onClick={guardar} disabled={!cambiados.length || guardando}>
          {guardando ? 'Guardando…' : cambiados.length ? `Guardar cambios (${cambiados.length})` : 'Sin cambios'}
        </button>
      </div>
      <div className="space-y-4">
        {TIPOS_MENSAJE.map((t) => (
          <div key={t.valor}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor={`msg-${t.valor}`} className="flex items-center gap-2 text-sm font-semibold text-white">
                {t.etiqueta}
                {actual === t.valor && <span className="chip border-flux-400/50 bg-flux-500/20 text-flux-100">Toca ahora</span>}
              </label>
              <ContadorCaracteres texto={textos[t.campo]} esInvitacion={t.valor === 'invitacion'} />
            </div>
            <textarea
              id={`msg-${t.valor}`}
              className={`input min-h-[110px] leading-relaxed ${
                t.valor === 'invitacion' && textos[t.campo].length > 300 ? 'border-rose-400/70 focus:border-rose-400 focus:ring-rose-400' : ''
              }`}
              value={textos[t.campo]}
              onChange={(e) => setTextos((x) => ({ ...x, [t.campo]: e.target.value }))}
            />
            <div className="mt-1.5 flex flex-wrap gap-2">
              <BotonCopiar texto={textos[t.campo]} className="btn-secundario btn-chico" />
              {REGENERAR_HABILITADO && (
                <button
                  className="btn-secundario btn-chico"
                  onClick={() => regenerar(t.valor, t.campo)}
                  disabled={Boolean(regenerando)}
                >
                  {regenerando === t.valor ? 'Regenerando…' : '✦ Regenerar mensaje'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
