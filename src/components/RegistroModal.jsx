import { useEffect, useState } from 'react'
import Modal from './Modal'
import { useToast } from './Toast'
import { ESTADOS, ESTADOS_CERRADOS } from '../lib/constantes'
import { registrarYActualizar } from '../lib/acciones'
import { nombreCompleto } from '../lib/mensajes'

export const TIPOS_REGISTRO = [
  { tipo: 'respuesta', etiqueta: 'Respuesta', estado: 'Respondió' },
  { tipo: 'llamada', etiqueta: 'Llamada', estado: 'Llamada hecha' },
  { tipo: 'reunión', etiqueta: 'Demo coordinada', estado: 'Demo agendada' },
  { tipo: 'demo', etiqueta: 'Demo hecha', estado: 'Demo hecha' },
  { tipo: 'propuesta', etiqueta: 'Propuesta', estado: 'Propuesta' },
  { tipo: 'email', etiqueta: 'Email', estado: null },
]

const RESULTADOS = {
  respuesta: ['Interesado', 'Pide más info', 'No es el momento', 'No interesado'],
  llamada: ['Buena llamada', 'Coordinamos demo', 'No atendió', 'Pide que lo llame más adelante'],
  'reunión': ['Demo confirmada', 'Reprogramada'],
  demo: ['Muy interesado', 'Pide diagnóstico', 'Pide propuesta', 'Sin interés'],
  propuesta: ['Enviada', 'En evaluación', 'Aceptada', 'Rechazada'],
  email: ['Enviado', 'Respondido'],
}

/** Sugiere el estado solo si es un avance respecto del actual. */
function estadoSugerido(tipo, actual) {
  const destino = TIPOS_REGISTRO.find((t) => t.tipo === tipo)?.estado
  if (!destino || ESTADOS_CERRADOS.includes(actual)) return ''
  return ESTADOS.indexOf(destino) > ESTADOS.indexOf(actual) ? destino : ''
}

const ahoraLocal = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/** Registro de llamada / demo / respuesta con resultado y notas. */
export default function RegistroModal({ prospecto, tipoInicial = 'respuesta', abierto, onCerrar, onGuardado }) {
  const avisar = useToast()
  const [tipo, setTipo] = useState(tipoInicial)
  const [resultado, setResultado] = useState('')
  const [notas, setNotas] = useState('')
  const [estado, setEstado] = useState('')
  const [fecha, setFecha] = useState(ahoraLocal())
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto || !prospecto) return
    setTipo(tipoInicial)
    setResultado('')
    setNotas('')
    setFecha(ahoraLocal())
    setEstado(estadoSugerido(tipoInicial, prospecto.estado))
  }, [abierto, tipoInicial, prospecto])

  if (!prospecto) return null

  function cambiarTipo(nuevo) {
    setTipo(nuevo)
    setResultado('')
    setEstado(estadoSugerido(nuevo, prospecto.estado))
  }

  function elegirResultado(r) {
    setResultado(r)
    if (r === 'No interesado' || r === 'Sin interés' || r === 'Rechazada') setEstado('No interesado')
    if (r === 'Aceptada') setEstado('Cliente')
  }

  async function guardar() {
    setGuardando(true)
    try {
      const actualizado = await registrarYActualizar(prospecto, {
        tipo,
        estadoNuevo: estado || null,
        resultado,
        notas,
        fecha: new Date(fecha).toISOString(),
      })
      avisar('Actividad registrada')
      onGuardado?.(actualizado)
      onCerrar()
    } catch (e) {
      avisar(`No se pudo registrar: ${e.message}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Registrar · ${nombreCompleto(prospecto)}`}
      pie={
        <>
          <button className="btn-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn-primario" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="label">Qué pasó</span>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_REGISTRO.map((t) => (
              <button
                key={t.tipo}
                type="button"
                onClick={() => cambiarTipo(t.tipo)}
                className={`btn btn-chico border ${
                  tipo === t.tipo ? 'border-flux-400 bg-flux-500/30 text-white' : 'border-white/10 bg-white/5 text-slate-300'
                }`}
              >
                {t.etiqueta}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="reg-resultado">
            Resultado
          </label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(RESULTADOS[tipo] || []).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => elegirResultado(r)}
                className={`chip cursor-pointer ${
                  resultado === r ? 'border-flux-400 bg-flux-500/30 text-white' : 'border-white/15 text-slate-300 hover:bg-white/5'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            id="reg-resultado"
            className="input"
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            placeholder="Escribí el resultado o elegí uno"
          />
        </div>
        <div>
          <label className="label" htmlFor="reg-notas">
            Notas
          </label>
          <textarea
            id="reg-notas"
            className="input min-h-[90px]"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Qué dijo, próximos pasos, objeciones…"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="reg-estado">
              Cambiar estado a
            </label>
            <select id="reg-estado" className="input" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">No cambiar ({prospecto.estado})</option>
              {ESTADOS.filter((e) => e !== prospecto.estado).map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="reg-fecha">
              Fecha
            </label>
            <input
              id="reg-fecha"
              type="datetime-local"
              className="input"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
