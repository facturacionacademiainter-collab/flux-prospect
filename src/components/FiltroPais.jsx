import { useMemo } from 'react'
import { codigoPais, ordenPais, paisDe } from '../lib/constantes'

/** Código ISO del país en una insignia chica (las banderas emoji no se ven en Windows). */
export function PaisBadge({ pais, conNombre = false }) {
  return (
    <span className="chip gap-1 border-sky-400/30 bg-sky-500/10 text-sky-100" title={pais}>
      <span className="font-mono text-[10px] font-bold tracking-wider">{codigoPais(pais)}</span>
      {conNombre && pais}
    </span>
  )
}

/** Cuenta prospectos por país, ordenado según PAISES. */
export function contarPorPais(prospectos) {
  const conteo = new Map()
  for (const p of prospectos || []) conteo.set(paisDe(p), (conteo.get(paisDe(p)) || 0) + 1)
  return [...conteo.entries()].sort(([a], [b]) => ordenPais(a, b))
}

/**
 * Selector de país: un botón por país con su cantidad, todos a la vista (hacen wrap).
 * valor = '' es "Todos los países". Con conTodos = false no se ofrece esa opción.
 */
export default function FiltroPais({ prospectos, valor, onCambiar, conTodos = true }) {
  const paises = useMemo(() => contarPorPais(prospectos), [prospectos])
  if (paises.length < 2 && !valor) return null
  const clase = (activo) =>
    `flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
      activo
        ? 'border-flux-400/60 bg-flux-500 text-white shadow-lg shadow-flux-500/20'
        : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-flux-400/40 hover:bg-white/[0.08] hover:text-white'
    }`
  return (
    <nav className="flex flex-wrap gap-2" aria-label="País">
      {paises.map(([pais, n]) => (
        <button key={pais} className={clase(valor === pais)} onClick={() => onCambiar(pais)} aria-pressed={valor === pais}>
          <span className="font-mono text-[10px] font-bold opacity-70">{codigoPais(pais)}</span>
          {pais}
          <span className="tabular-nums opacity-70">{n}</span>
        </button>
      ))}
      {conTodos && (
        <button className={clase(!valor)} onClick={() => onCambiar('')} aria-pressed={!valor}>
          Todos los países <span className="tabular-nums opacity-70">{prospectos?.length || 0}</span>
        </button>
      )}
    </nav>
  )
}
