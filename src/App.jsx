import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { SesionProvider, useSesion } from './lib/sesion'
import { DatosAppProvider, useDatosApp } from './lib/datosApp'
import { ToastProvider } from './components/Toast'
import { Cargando, ErrorCaja } from './components/Insignias'
import Layout from './components/Layout'
import Login from './pages/Login'
import Hoy from './pages/Hoy'

// Las pantallas pesadas (gráficos, Excel, drag & drop) se cargan a demanda.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Pipeline = lazy(() => import('./pages/Pipeline'))
const Prospectos = lazy(() => import('./pages/Prospectos'))
const Mapa = lazy(() => import('./pages/Mapa'))
const Ficha = lazy(() => import('./pages/Ficha'))
const Ajustes = lazy(() => import('./pages/Ajustes'))

export default function App() {
  return (
    <ToastProvider>
      <SesionProvider>
        <Puerta />
      </SesionProvider>
    </ToastProvider>
  )
}

/** Todo el panel queda detrás del login. */
function Puerta() {
  const { sesion, cargando } = useSesion()
  if (cargando) return <Cargando />
  if (!sesion) return <Login />
  return (
    <DatosAppProvider>
      <Panel />
    </DatosAppProvider>
  )
}

function Panel() {
  const { config, error } = useDatosApp()
  if (error)
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorCaja error={`No pudimos cargar tu configuración: ${error}`} />
      </div>
    )
  if (!config) return <Cargando texto="Preparando el panel…" />
  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Hoy />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="prospectos" element={<Prospectos />} />
          <Route path="mapa" element={<Mapa />} />
          <Route path="prospecto/:id" element={<Ficha />} />
          <Route path="ajustes" element={<Ajustes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
