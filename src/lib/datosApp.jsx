import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, ok } from './supabase'
import { asegurarConfiguracion, guardarConfiguracion } from './configuracion'
import { useSesion } from './sesion'

const DatosContext = createContext(null)

/** Configuración del usuario y plantillas: se cargan una vez y se comparten. */
export function DatosAppProvider({ children }) {
  const { sesion } = useSesion()
  const ownerId = sesion?.user?.id
  const [config, setConfig] = useState(null)
  const [plantillas, setPlantillas] = useState([])
  const [error, setError] = useState(null)

  const recargarPlantillas = useCallback(async () => {
    const data = ok(await supabase.from('plantillas').select('*').order('tipo').order('nombre'))
    setPlantillas(data)
    return data
  }, [])

  useEffect(() => {
    if (!ownerId) return
    let vivo = true
    ;(async () => {
      try {
        const [c] = await Promise.all([asegurarConfiguracion(ownerId), recargarPlantillas()])
        if (vivo) setConfig(c)
      } catch (e) {
        if (vivo) setError(e.message)
      }
    })()
    return () => {
      vivo = false
    }
  }, [ownerId, recargarPlantillas])

  const actualizarConfig = useCallback(
    async (cambios) => {
      const nueva = await guardarConfiguracion(ownerId, cambios)
      setConfig(nueva)
      return nueva
    },
    [ownerId],
  )

  return (
    <DatosContext.Provider value={{ ownerId, config, plantillas, recargarPlantillas, actualizarConfig, error }}>
      {children}
    </DatosContext.Provider>
  )
}

export const useDatosApp = () => useContext(DatosContext)
