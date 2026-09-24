export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    // Fallback para navegadores sin Clipboard API o sin contexto seguro.
    const area = document.createElement('textarea')
    area.value = texto
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    let copiado = false
    try {
      copiado = document.execCommand('copy')
    } catch {
      copiado = false
    }
    document.body.removeChild(area)
    return copiado
  }
}
