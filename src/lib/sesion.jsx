import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const SesionContext = createContext({ sesion: null, cargando: true })

export function SesionProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva))
    return () => data.subscription.unsubscribe()
  }, [])

  return <SesionContext.Provider value={{ sesion, cargando }}>{children}</SesionContext.Provider>
}

export const useSesion = () => useContext(SesionContext)
