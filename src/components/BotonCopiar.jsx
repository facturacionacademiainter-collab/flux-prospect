import { useState } from 'react'
import { copiarTexto } from '../lib/portapapeles'
import { useToast } from './Toast'

export default function BotonCopiar({ texto, etiqueta = 'Copiar', className = 'btn-secundario', aviso }) {
  const avisar = useToast()
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    if (!texto) return
    const listo = await copiarTexto(texto)
    if (listo) {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1600)
      avisar(aviso || 'Copiado al portapapeles')
    } else {
      avisar('No se pudo copiar. Seleccioná el texto a mano.', 'error')
    }
  }

  return (
    <button type="button" className={className} onClick={copiar} disabled={!texto}>
      {copiado ? '✓ Copiado' : etiqueta}
    </button>
  )
}
