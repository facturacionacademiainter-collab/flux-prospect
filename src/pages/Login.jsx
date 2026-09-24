import { useState } from 'react'
import { supabase, supabaseConfigurado } from '../lib/supabase'
import { Marca } from '../components/Layout'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function entrar(e) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (err) {
      setError(
        err.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : `No pudimos entrar: ${err.message}`,
      )
    }
    setEnviando(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={entrar} className="glass w-full max-w-sm space-y-5 p-7">
        <Marca />
        <div>
          <h1 className="text-xl font-bold text-white">Ingresá al panel</h1>
          <p className="mt-1 text-sm text-slate-400">Acceso privado. No hay registro público.</p>
        </div>
        {!supabaseConfigurado && (
          <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el build.
          </p>
        )}
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button type="submit" className="btn-primario w-full py-2.5" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
