import { useEffect, useRef, useState } from 'react'

/**
 * Celda de tabla editable en el lugar. Texto/número: clic para editar,
 * Enter o salir del campo guarda, Escape cancela. Con `opciones` es un select.
 */
export default function CeldaEditable({ valor, onGuardar, tipo = 'text', opciones, placeholder = '—', className = '' }) {
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState(valor ?? '')
  const [guardando, setGuardando] = useState(false)
  const ref = useRef(null)
  const enCurso = useRef(false) // evita doble guardado (Enter + blur)

  useEffect(() => {
    if (!editando) setBorrador(valor ?? '')
  }, [valor, editando])

  useEffect(() => {
    if (editando) ref.current?.focus()
  }, [editando])

  async function guardar(nuevo = borrador) {
    if (enCurso.current) return
    const normal = typeof nuevo === 'string' ? nuevo.trim() : nuevo
    const final = normal === '' ? null : tipo === 'number' ? Number(normal) : normal
    if ((final ?? null) === (valor ?? null)) {
      setEditando(false)
      return
    }
    enCurso.current = true
    setGuardando(true)
    try {
      await onGuardar(final)
      setEditando(false)
    } catch {
      setBorrador(valor ?? '')
      setEditando(false)
    } finally {
      enCurso.current = false
      setGuardando(false)
    }
  }

  if (opciones) {
    return (
      <select
        className={`w-full cursor-pointer rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-white/15 focus:border-flux-400 focus:outline-none ${className}`}
        value={valor ?? ''}
        disabled={guardando}
        onChange={(e) => guardar(e.target.value)}
      >
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className={`w-full truncate rounded-lg border border-transparent px-1.5 py-1 text-left hover:border-white/15 hover:bg-white/5 ${
          valor == null || valor === '' ? 'text-slate-600' : ''
        } ${className}`}
        title="Clic para editar"
      >
        {valor == null || valor === '' ? placeholder : valor}
      </button>
    )
  }

  return (
    <input
      ref={ref}
      type={tipo}
      className="input px-1.5 py-1"
      value={borrador}
      disabled={guardando}
      onChange={(e) => setBorrador(e.target.value)}
      onBlur={() => guardar()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') guardar()
        if (e.key === 'Escape') {
          setBorrador(valor ?? '')
          setEditando(false)
        }
      }}
    />
  )
}
