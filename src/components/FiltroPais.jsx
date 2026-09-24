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

/** Pestañas "Todos / país (n)". valor = '' es Todos. */
export default function FiltroPais({ prospectos, valor, onCambiar }) {
  const paises = useMemo(() => contarPorPais(prospectos), [prospectos])
  if (paises.length < 2 && !valor) return null
  const clase = (activo) =>
    `btn btn-chico whitespace-nowrap ${activo ? 'bg-flux-500 text-white' : 'text-slate-300 hover:bg-white/5'}`
  return (
    <nav
      className="scroll-fino flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1"
      aria-label="Filtrar por país"
    >
      <button className={clase(!valor)} onClick={() => onCambiar('')} aria-pressed={!valor}>
        Todos <span className="opacity-70">({prospectos?.length || 0})</span>
      </button>
      {paises.map(([pais, n]) => (
        <button key={pais} className={clase(valor === pais)} onClick={() => onCambiar(pais)} aria-pressed={valor === pais}>
          <span className="font-mono text-[10px] font-bold opacity-80">{codigoPais(pais)}</span> {pais}{' '}
          <span className="opacity-70">({n})</span>
        </button>
      ))}
    </nav>
  )
}
