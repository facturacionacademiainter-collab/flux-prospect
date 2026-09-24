# Prospección automática semanal

Instrucciones para la tarea programada que cada lunes suma 10 prospectos nuevos a Flux Prospect
y actualiza los contactos sin confirmar de los que ya están cargados.
Los prospectos entran **para revisar**: Mauro los aprueba o descarta en el panel antes de invitarlos.

## Contexto

Flux Collect es un SaaS de cobranza con IA: para cada deudor estima la probabilidad de pago a 5, 10 y 30 días
y sugiere canal (WhatsApp, email, teléfono) y horario. Oferta de entrada: diagnóstico gratis de la cartera
con un Excel anonimizado, entregado en una semana.
Lo vende Mauro Alegre, que lideró cobranzas en Cuotitas y Banco Columbia y hoy trabaja en Moovitech.
Prospecta a mano por LinkedIn, desde su experiencia de colega, no como vendedor.

## Perfil buscado

Entidades de crédito de consumo en cuotas **chicas y medianas, poco o medianamente conocidas**, con cartera
activa en 2026. Mauro rechazó empresas grandes y conocidas (Naranja X, Ualá, Frávega, Credicuotas, etc.).

Segmentos (valores exactos del campo `segmento`):
`Fintech de crédito`, `Financiera`, `Mutual/Cooperativa`, `Retail con crédito`, `Automotor`, `Billetera con préstamos`.

Rotá el foco cada semana para no agotar siempre la misma veta: mutuales y cooperativas (Santa Fe, Córdoba,
Entre Ríos, Buenos Aires), tarjetas regionales no bancarias (listado de emisoras del BCRA, CERTACyC),
PNFC del BCRA y fintechs chicas (originadores de fideicomisos PyME en CNV/BYMA), retail regional con crédito
propio, prendarios y motos. Argentina primero; cuando se agote, LatAm.

Contacto preferido, en este orden: gerente/jefe de cobranzas o recupero, riesgo o créditos, operaciones,
CFO o finanzas, y en empresas chicas el CEO o fundador.

## Reglas de datos (no negociables)

- NUNCA inventes nombres, cargos, URLs ni cifras. Cada dato sale de una fuente pública real, que va en `fuente`.
- No entres a LinkedIn ni lo automatices: solo búsqueda web pública (los títulos de resultados de búsqueda sirven).
- `verificacion`: `Verificado` solo si viste la URL del perfil con cargo y empresa actuales;
  `Por verificar` si encontraste a la persona pero no lo confirmaste; `Sin perfil` si no la encontraste
  (nombre, apellido y URL vacíos, cargo `"<cargo> (a identificar)"`).
- `link_busqueda` siempre: `https://www.linkedin.com/search/results/people/?keywords=<nombre o cargo + empresa, url-encoded>`.
- Si una cifra es estimación tuya, escribí "calculo". Si no hay noticias con fecha, decilo.
- Prefiero 7 reales a 10 dudosos: si no llegás, cargá los que tengas.

## Mensajes

Español rioplatense, voseo, tono de colega de cobranzas. Sin emojis ni frases de vendedor
("potenciar", "revolucionar", "sinergia"). Cada mensaje usa un dato real y específico de esa entidad.
Variá la apertura entre prospectos y mencioná Cuotitas, Banco Columbia o Moovitech a veces, no siempre los tres.

- `invitacion`: 190 a 260 caracteres (máximo duro 300). Sin links ni pitch.
- `mensaje_1`: 370 a 490 caracteres. Agradece, plantea un dolor concreto, qué hace Flux en una frase,
  ofrece el diagnóstico gratis con un Excel anonimizado.
- `followup`: pregunta de colega con un dato técnico (roll rate, cura, promesas, tramos) aplicado a su caso.
- `cierre`: salida amable, sin presión, con un guiño local.

## Pasos

1. Nombres ya cargados (para no repetir): `node scripts/nombres-existentes.mjs`.
   Sumá también los nombres de `data/tanda-1-grandes.json` (descartadas por grandes) y de `data/*.json` y `data/auto/*.json`.
2. Investigá 10 entidades nuevas que no estén en esa lista.
3. Guardá `data/auto/AAAA-MM-DD.json` con la forma `{"tanda": "auto-AAAA-MM-DD", "prospectos": [...]}`.
   Cada item tiene exactamente la forma de los de `data/tanda-2.json`, más `"origen": "auto-AAAA-MM-DD"`.
   Ordená por `score_fit` descendente.
4. Validá con código antes de cargar: JSON válido, segmento y verificación dentro de los valores permitidos,
   `score_fit` entre 1 y 100, invitación ≤ 300, `mensaje_1` ≤ 600, sin empresas repetidas.
5. Cargá: `node scripts/cargar-auto.mjs data/auto/AAAA-MM-DD.json` (usa `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   y `FLUX_CLAVE_CARGA` del entorno). Revisá `insertados`, `omitidos` y `rechazados`; corregí y recargá los rechazados.
6. Actualizá los contactos existentes (ver "Actualización de contactos" abajo).
7. Commit de los JSON (mensaje en español, p. ej. "Prospección automática AAAA-MM-DD: N prospectos, M contactos") y push.
8. Terminá con un resumen: tabla empresa / región / contacto / cargo / verificación / score, otra tabla
   de contactos actualizados (empresa / antes / ahora / verificación), y avisos
   (contactos dudosos, datos viejos, empresas que quizás sean grandes).

## Actualización de contactos

Cada semana, además de sumar prospectos, re-investigá los contactos sin confirmar de los ya cargados.
Solo aplica a prospectos en `Por invitar` con verificación `Por verificar` o `Sin perfil`; los ya
invitados y los `Verificado` no se tocan (la base lo impide igual).

1. Pendientes: `node scripts/contactos-pendientes.mjs --max 10` (JSON; primero los `Sin perfil`, después por score).
2. Para cada uno, buscá con las mismas reglas de datos de arriba:
   - `Sin perfil`: encontrá a la persona del cargo preferido (orden de "Perfil buscado").
   - `Por verificar`: confirmá que el perfil muestre cargo y empresa actuales. Si ya no está en la empresa,
     buscá a quien lo reemplazó.
   - Si no encontrás nada nuevo, no lo incluyas. La verificación nunca baja.
3. Guardá `data/auto/contactos-AAAA-MM-DD.json` con la forma `{"contactos": [...]}`. Cada item lleva el `id`
   del pendiente, `empresa.nombre` (para el reporte) y solo los campos que cambian: `nombre`, `apellido`,
   `cargo`, `url_linkedin`, `link_busqueda`, `verificacion` y `fuente` (obligatoria si cambia la persona
   o la verificación). Si cambia la persona, reescribí los cuatro mensajes en `mensajes` con las reglas de
   "Mensajes"; si es la misma, no los mandes.
4. Cargá: `node scripts/actualizar-contactos.mjs data/auto/contactos-AAAA-MM-DD.json`. Revisá `actualizados`,
   `omitidos` y `rechazados`; corregí y recargá los rechazados. Cada cambio queda anotado en las notas
   del prospecto con lo que había antes.
