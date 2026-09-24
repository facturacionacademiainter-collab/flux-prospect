import { useEffect, useState } from 'react'
import Modal from './Modal'
import { useToast } from './Toast'
import { supabase, ok } from '../lib/supabase'
import { SELECT_PROSPECTO } from '../lib/acciones'
import { ESTADOS, PAISES, PAIS_POR_DEFECTO, SEGMENTOS, VERIFICACIONES } from '../lib/constantes'

const PERSONA_VACIA = {
  nombre: '',
  apellido: '',
  cargo: '',
  url_linkedin: '',
  link_busqueda: '',
  verificacion: 'Por verificar',
  estado: 'Por invitar',
  gancho: '',
}

const EMPRESA_VACIA = { nombre: '', segmento: '', pais: PAIS_POR_DEFECTO, web: '', region: '', tamano: '', score_fit: '' }

const nulo = (v) => (typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v)

/** Alta manual de un prospecto, en una empresa existente o nueva. */
export default function AltaProspectoModal({ abierto, onCerrar, empresas, onCreado }) {
  const avisar = useToast()
  const [modo, setModo] = useState('existente')
  const [empresaId, setEmpresaId] = useState('')
  const [empresa, setEmpresa] = useState(EMPRESA_VACIA)
  const [persona, setPersona] = useState(PERSONA_VACIA)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setModo(empresas.length ? 'existente' : 'nueva')
    setEmpresaId('')
    setEmpresa(EMPRESA_VACIA)
    setPersona(PERSONA_VACIA)
  }, [abierto, empresas.length])

  const campoPersona = (k) => ({ value: persona[k], onChange: (e) => setPersona((p) => ({ ...p, [k]: e.target.value })) })
  const campoEmpresa = (k) => ({ value: empresa[k], onChange: (e) => setEmpresa((p) => ({ ...p, [k]: e.target.value })) })

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    try {
      let idEmpresa = empresaId
      if (modo === 'nueva') {
        if (!empresa.nombre.trim()) throw new Error('Poné el nombre de la empresa')
        const score = empresa.score_fit === '' ? null : Number(empresa.score_fit)
        const creada = ok(
          await supabase
            .from('empresas')
            .insert({
              nombre: empresa.nombre.trim(),
              segmento: nulo(empresa.segmento),
              web: nulo(empresa.web),
              pais: empresa.pais || PAIS_POR_DEFECTO,
              region: nulo(empresa.region),
              tamano: nulo(empresa.tamano),
              score_fit: score,
            })
            .select('id')
            .single(),
        )
        idEmpresa = creada.id
      } else if (!idEmpresa) {
        throw new Error('Elegí una empresa')
      }
      const fila = Object.fromEntries(Object.entries(persona).map(([k, v]) => [k, nulo(v)]))
      const creado = ok(
        await supabase
          .from('prospectos')
          .insert({ ...fila, empresa_id: idEmpresa })
          .select(SELECT_PROSPECTO)
          .single(),
      )
      avisar('Prospecto creado')
      onCreado(creado)
      onCerrar()
    } catch (err) {
      const msg = err.code === '23505' ? 'Ya existe una empresa con ese nombre: elegila de la lista.' : err.message
      avisar(msg, 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Nuevo prospecto"
      ancho="max-w-2xl"
      pie={
        <>
          <button className="btn-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn-primario" type="submit" form="form-alta" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Crear prospecto'}
          </button>
        </>
      }
    >
      <form id="form-alta" onSubmit={guardar} className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="mb-2 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            {[
              ['existente', 'Empresa existente'],
              ['nueva', 'Empresa nueva'],
            ].map(([id, t]) => (
              <button
                key={id}
                type="button"
                onClick={() => setModo(id)}
                className={`btn btn-chico ${modo === id ? 'bg-flux-500 text-white' : 'text-slate-300'}`}
              >
                {t}
              </button>
            ))}
          </legend>
          {modo === 'existente' ? (
            <div>
              <label className="label" htmlFor="alta-empresa">
                Empresa
              </label>
              <select id="alta-empresa" className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                <option value="">Elegí una…</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Nombre de la empresa *" id="em-nombre" {...campoEmpresa('nombre')} />
              <div>
                <label className="label" htmlFor="em-seg">
                  Segmento
                </label>
                <select id="em-seg" className="input" {...campoEmpresa('segmento')}>
                  <option value="">Sin segmento</option>
                  {SEGMENTOS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <Campo etiqueta="Web" id="em-web" {...campoEmpresa('web')} />
              <div>
                <label className="label" htmlFor="em-pais">
                  País
                </label>
                <select id="em-pais" className="input" {...campoEmpresa('pais')}>
                  {PAISES.map(([p]) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <Campo etiqueta="Región" id="em-region" {...campoEmpresa('region')} />
              <Campo etiqueta="Tamaño" id="em-tamano" {...campoEmpresa('tamano')} />
              <Campo etiqueta="Score de fit (1-100)" id="em-score" type="number" min="1" max="100" {...campoEmpresa('score_fit')} />
            </div>
          )}
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre" id="pe-nombre" {...campoPersona('nombre')} />
          <Campo etiqueta="Apellido" id="pe-apellido" {...campoPersona('apellido')} />
          <Campo etiqueta="Cargo" id="pe-cargo" {...campoPersona('cargo')} />
          <Campo etiqueta="URL de LinkedIn" id="pe-url" type="url" {...campoPersona('url_linkedin')} />
          <Campo etiqueta="Link de búsqueda" id="pe-busq" type="url" {...campoPersona('link_busqueda')} />
          <div>
            <label className="label" htmlFor="pe-verif">
              Verificación
            </label>
            <select id="pe-verif" className="input" {...campoPersona('verificacion')}>
              {VERIFICACIONES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pe-estado">
              Estado
            </label>
            <select id="pe-estado" className="input" {...campoPersona('estado')}>
              {ESTADOS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pe-gancho">
              Gancho
            </label>
            <textarea id="pe-gancho" className="input min-h-[70px]" {...campoPersona('gancho')} />
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}

function Campo({ etiqueta, id, ...resto }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {etiqueta}
      </label>
      <input id={id} className="input" {...resto} />
    </div>
  )
}
