import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/** Modal propio (nunca usamos window.alert/confirm/prompt). */
export default function Modal({ abierto, onCerrar, titulo, children, pie, ancho = 'max-w-lg' }) {
  useEffect(() => {
    if (!abierto) return
    const onKey = (e) => e.key === 'Escape' && onCerrar?.()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCerrar} />
      <div
        className={`glass-strong relative flex max-h-[92vh] w-full ${ancho} flex-col rounded-b-none sm:rounded-2xl`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <h2 className="text-lg font-semibold text-white">{titulo}</h2>
          <button className="btn-fantasma btn-chico" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="scroll-fino overflow-y-auto px-5 py-4">{children}</div>
        {pie && <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-3">{pie}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** Confirmación con modal propio. */
export function ConfirmarModal({ abierto, titulo, mensaje, textoConfirmar = 'Confirmar', peligro, onConfirmar, onCerrar }) {
  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      pie={
        <>
          <button className="btn-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className={peligro ? 'btn-peligro' : 'btn-primario'} onClick={onConfirmar}>
            {textoConfirmar}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-300">{mensaje}</p>
    </Modal>
  )
}
