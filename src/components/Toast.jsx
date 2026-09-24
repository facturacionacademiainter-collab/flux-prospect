import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const avisar = useCallback((texto, tipo = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, texto, tipo }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === 'error' ? 6000 : 2800)
  }, [])

  return (
    <ToastContext.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto max-w-md rounded-xl border px-4 py-2.5 text-sm font-medium shadow-2xl backdrop-blur-xl ${
              t.tipo === 'error'
                ? 'border-rose-400/40 bg-rose-950/80 text-rose-100'
                : 'border-flux-400/40 bg-[#1f1630]/90 text-flux-50'
            }`}
          >
            {t.texto}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** avisar(texto, 'ok' | 'error') */
export const useToast = () => useContext(ToastContext)
