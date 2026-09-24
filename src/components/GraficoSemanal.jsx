import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatoFecha } from '../lib/fechas'

// Paleta categórica validada para fondo oscuro (lightness, croma, CVD y contraste).
export const SERIES = [
  { clave: 'invitaciones', etiqueta: 'Invitaciones', color: '#8C68B1' },
  { clave: 'mensajes', etiqueta: 'Mensajes', color: '#C98500' },
  { clave: 'respuestas', etiqueta: 'Respuestas', color: '#199E70' },
  { clave: 'demos', etiqueta: 'Demos coordinadas', color: '#D95926' },
]

const etiquetaSemana = (iso) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function TooltipSemana({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/15 bg-[#1a1424]/95 px-3 py-2 text-xs shadow-2xl backdrop-blur-xl">
      <p className="mb-1 font-semibold text-white">Semana del {formatoFecha(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-300">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: <strong className="tabular-nums text-white">{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function GraficoSemanal({ datos }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="semana"
            tickFormatter={etiquetaSemana}
            stroke="rgba(255,255,255,0.25)"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            stroke="rgba(255,255,255,0.25)"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<TooltipSemana />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Legend
            iconType="square"
            iconSize={9}
            wrapperStyle={{ fontSize: 12, color: '#cbd5e1', paddingTop: 6 }}
            formatter={(v) => <span className="text-slate-300">{v}</span>}
          />
          {SERIES.map((s) => (
            <Bar key={s.clave} dataKey={s.clave} name={s.etiqueta} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
