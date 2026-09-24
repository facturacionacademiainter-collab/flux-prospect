import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSesion } from '../lib/sesion'
import { alCambiarRevision, contarPendientes } from '../lib/revision'

const SECCIONES = [
  { a: '/', texto: 'Hoy', icono: IconoHoy },
  { a: '/dashboard', texto: 'KPIs', icono: IconoKpi },
  { a: '/pipeline', texto: 'Pipeline', icono: IconoPipeline },
  { a: '/prospectos', texto: 'Prospectos', icono: IconoTabla },
  { a: '/mapa', texto: 'Mapa', icono: IconoMapa },
  { a: '/ajustes', texto: 'Ajustes', icono: IconoAjustes },
]

/** Prospectos cargados automáticamente que esperan revisión (se refresca al navegar y al aprobar/descartar). */
function usePendientesRevision() {
  const { pathname } = useLocation()
  const [pendientes, setPendientes] = useState(0)
  useEffect(() => {
    let vivo = true
    const refrescar = () =>
      contarPendientes()
        .then((n) => vivo && setPendientes(n))
        .catch(() => {})
    refrescar()
    const soltar = alCambiarRevision(refrescar)
    return () => {
      vivo = false
      soltar()
    }
  }, [pathname])
  return pendientes
}

function Contador({ n, flotante }) {
  if (!n) return null
  return (
    <span
      className={`grid min-w-[1.25rem] place-items-center rounded-full bg-fuchsia-500 px-1.5 text-[10px] font-bold leading-5 text-white ${
        flotante ? 'absolute -right-3 -top-1.5' : 'ml-auto'
      }`}
      title={`${n} para revisar`}
      aria-label={`${n} para revisar`}
    >
      {n}
    </span>
  )
}

export default function Layout() {
  const { sesion } = useSesion()
  const pendientes = usePendientesRevision()
  const contadorDe = (a) => (a === '/prospectos' ? pendientes : 0)

  return (
    <div className="min-h-screen md:pl-60">
      {/* Barra lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/10 bg-black/20 px-4 py-6 backdrop-blur-xl md:flex">
        <Marca />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {SECCIONES.map(({ a, texto, icono: Icono }) => (
            <NavLink
              key={a}
              to={a}
              end={a === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive ? 'bg-flux-500/20 text-white ring-1 ring-flux-400/40' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icono />
              {texto}
              <Contador n={contadorDe(a)} />
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 pt-4">
          <p className="truncate text-xs text-slate-500" title={sesion?.user?.email}>
            {sesion?.user?.email}
          </p>
          <button className="btn-fantasma btn-chico mt-2 w-full justify-start" onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Encabezado (mobile) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-fondo/80 px-4 py-3 backdrop-blur-xl md:hidden">
        <Marca />
        <button className="btn-fantasma btn-chico" onClick={() => supabase.auth.signOut()}>
          Salir
        </button>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
        <Outlet />
      </main>

      {/* Navegación inferior (mobile) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-white/10 bg-[#120d1b]/90 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {SECCIONES.map(({ a, texto, icono: Icono }) => (
          <NavLink
            key={a}
            to={a}
            end={a === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
                isActive ? 'text-flux-300' : 'text-slate-500'
              }`
            }
          >
            <span className="relative">
              <Icono />
              <Contador n={contadorDe(a)} flotante />
            </span>
            {texto}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-flux-500 text-sm font-bold text-white shadow-lg shadow-flux-500/30">
        F
      </span>
      <div className="leading-tight">
        <p className="text-sm font-bold text-white">Flux Prospect</p>
        <p className="text-[11px] text-slate-500">Flux Collect · ventas</p>
      </div>
    </div>
  )
}

const svg = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function IconoHoy() {
  return (
    <svg {...svg}>
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M3 9h18M8 2v4M16 2v4M8 14l2.5 2.5L16 12" />
    </svg>
  )
}
function IconoKpi() {
  return (
    <svg {...svg}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  )
}
function IconoPipeline() {
  return (
    <svg {...svg}>
      <rect x="3" y="3" width="5" height="18" rx="1.5" />
      <rect x="10" y="3" width="5" height="12" rx="1.5" />
      <rect x="17" y="3" width="4" height="8" rx="1.5" />
    </svg>
  )
}
function IconoTabla() {
  return (
    <svg {...svg}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 4v16" />
    </svg>
  )
}
function IconoMapa() {
  return (
    <svg {...svg}>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  )
}
function IconoAjustes() {
  return (
    <svg {...svg}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  )
}
