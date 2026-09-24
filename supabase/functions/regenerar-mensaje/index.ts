// Edge Function: regenerar-mensaje
// Reescribe uno de los 4 mensajes de un prospecto con Claude.
// NO envía nada a LinkedIn ni guarda en la base: devuelve el texto y el
// usuario lo revisa y guarda desde la ficha.
//
// Deploy:  supabase functions deploy regenerar-mensaje
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TIPOS: Record<string, { etiqueta: string; campo: string; guia: string }> = {
  invitacion: {
    etiqueta: 'nota de invitación de LinkedIn',
    campo: 'msg_invitacion',
    guia: 'Máximo 300 caracteres (límite duro de LinkedIn). Sin vender: presentarse y dar un motivo concreto para conectar.',
  },
  mensaje_1: {
    etiqueta: 'primer mensaje después de que aceptó la invitación',
    campo: 'msg_1',
    guia: 'Agradecer, mostrar que entendés su operación de cobranza, presentar Flux Collect en una línea y ofrecer un diagnóstico gratis de la cartera con un Excel anonimizado. Hasta ~700 caracteres.',
  },
  followup: {
    etiqueta: 'follow-up',
    campo: 'msg_followup',
    guia: 'Aportar un dato o una pregunta útil de cobranza (roll rate, mora temprana, priorización), sin presionar. Hasta ~450 caracteres.',
  },
  cierre: {
    etiqueta: 'mensaje de cierre',
    campo: 'msg_cierre',
    guia: 'Despedida amable que deja la puerta abierta, sin culpa ni presión. Hasta ~300 caracteres.',
  },
}

const SISTEMA = `Escribís mensajes de prospección en LinkedIn para Mauro Alegre, fundador de Flux Collect \
(SaaS de cobranza con IA que estima, para cada cliente, la probabilidad de pago a 5, 10 y 30 días y sugiere canal y horario). \
Mauro lideró cobranzas en Cuotitas y Banco Columbia. Escribís en español rioplatense (voseo), tono cercano y profesional, \
de colega a colega, sin emojis, sin signos de exclamación exagerados, sin frases de marketing ni promesas que no se puedan sostener. \
Usá solo datos que estén en el contexto: no inventes cifras ni hechos sobre la empresa. \
Respondé únicamente con el texto final del mensaje, sin comillas ni explicaciones.`

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const { prospecto_id, tipo, actual } = await req.json()
    const config = TIPOS[tipo]
    if (!prospecto_id || !config) return json({ error: 'Parámetros inválidos' }, 400)

    // Cliente con el JWT del usuario: RLS garantiza que solo lea lo suyo.
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: p, error } = await supabase
      .from('prospectos')
      .select('*, empresas(*)')
      .eq('id', prospecto_id)
      .maybeSingle()
    if (error) return json({ error: error.message }, 400)
    if (!p) return json({ error: 'Prospecto no encontrado' }, 404)

    const e = p.empresas ?? {}
    const contexto = [
      `Empresa: ${e.nombre ?? ''} (${e.segmento ?? 'sin segmento'})`,
      e.region && `Región: ${e.region}`,
      e.tamano && `Tamaño: ${e.tamano}`,
      e.analisis && `Análisis: ${e.analisis}`,
      e.noticias && `Noticias: ${e.noticias}`,
      `Persona: ${[p.nombre, p.apellido].filter(Boolean).join(' ') || '(sin nombre: no uses nombre propio)'}${p.cargo ? `, ${p.cargo}` : ''}`,
      p.gancho && `Gancho: ${p.gancho}`,
      p.msg_invitacion && tipo !== 'invitacion' && `Invitación ya enviada: ${p.msg_invitacion}`,
      p.msg_1 && tipo !== 'mensaje_1' && `Mensaje 1: ${p.msg_1}`,
      actual && `Versión actual de este mensaje (mejorala, no la copies): ${actual}`,
    ]
      .filter(Boolean)
      .join('\n')

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
    const respuesta = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      system: SISTEMA,
      messages: [
        {
          role: 'user',
          content: `Escribí la ${config.etiqueta}.\n${config.guia}\n\nContexto:\n${contexto}`,
        },
      ],
    })

    if (respuesta.stop_reason === 'refusal') return json({ error: 'El modelo no generó el mensaje' }, 502)
    const texto = respuesta.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')
      .trim()
    if (!texto) return json({ error: 'Respuesta vacía' }, 502)

    return json({ texto, campo: config.campo })
  } catch (err) {
    if (err instanceof Anthropic.APIError) return json({ error: `Anthropic ${err.status}: ${err.message}` }, 502)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
