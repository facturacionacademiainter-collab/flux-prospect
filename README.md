# Flux Prospect

Panel privado para prospectar a mano en LinkedIn clientes de Flux Collect.
Se publica en **https://fluxcollect.com/ventas/** como subcarpeta de la landing (GitHub Pages).

El panel **nunca envía nada a LinkedIn ni lo automatiza**: solo copia mensajes al
portapapeles y abre el perfil en una pestaña nueva. Vos mandás todo a mano.

Stack: Vite + React + Tailwind 3 + Supabase (Auth + Postgres con RLS). Rutas con
`HashRouter` (Pages no hace rewrites), `base: '/ventas/'`.

## Pantallas

| Ruta | Qué hace |
|---|---|
| `#/` Hoy | Cola del día (`proximo_toque <= hoy`, sin Cliente/No interesado), atrasados arriba. Copiar mensaje, abrir perfil, Marcar enviado, Aceptó, registrar respuesta/llamada/demo. Alerta si las invitaciones de hoy pasan el límite. |
| `#/dashboard` | KPIs por rango y segmento, ajustes manuales (se suman al automático), embudo, actividad semanal, rendimiento por segmento y plantilla, metas semanales. |
| `#/pipeline` | Kanban por estado con drag & drop (mouse, touch y teclado). |
| `#/prospectos` | Tabla con búsqueda, filtros, orden, edición inline, alta manual, importación y exportación Excel/CSV. |
| `#/prospecto/:id` | Ficha: análisis de la empresa, persona, mensajes editables, notas, oportunidad y línea de tiempo. |
| `#/ajustes` | Plantillas (CRUD con vista previa) y configuración: límite diario, cadencias y metas. |

## Variables de entorno

Copiá `.env.example` a `.env` y completá:

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto (Settings → API). |
| `VITE_SUPABASE_ANON_KEY` | anon key (es pública por diseño; RLS protege los datos). |
| `VITE_ENABLE_REGENERAR` | `true` muestra el botón "Regenerar mensaje" (requiere la Edge Function). Cualquier otro valor lo oculta. |
| `SEED_EMAIL`, `SEED_PASSWORD` | Solo para `npm run seed`. No se usan en el build. |

`.env` está en `.gitignore`. Nunca subas claves reales.

## Puesta en marcha

### 1. Crear el proyecto Supabase

1. En https://supabase.com/dashboard → **New project** (región São Paulo, por cercanía).
2. **Authentication → Sign In / Providers → Email**: dejá Email habilitado y **desactivá "Allow new users to sign up"** (no hay registro público).
3. **Authentication → URL Configuration**: Site URL `https://fluxcollect.com/ventas/`.
4. **Settings → API**: copiá Project URL y anon key a `.env`.

### 2. Aplicar las migraciones (en orden)

Opción A, con la CLI:

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

Opción B, a mano: en **SQL Editor** pegá y ejecutá, en este orden:

1. `supabase/migrations/20260924000000_esquema_inicial.sql`
2. `supabase/migrations/20260924000001_region_y_tipos_actividad.sql`

La segunda agrega `empresas.region`, los tipos de actividad `respuesta`, `aceptación` y
`cambio de estado`, y la cadencia `Conectado: 0` (así el que acepta la invitación
aparece en Hoy para el mensaje 1).

### 3. Crear el usuario

**Authentication → Users → Add user → Create new user**: email y contraseña de Mauro,
con **Auto Confirm User** tildado. Es el único usuario; todo queda asociado a su `owner_id`.

### 4. Cargar los datos (seed)

```bash
npm install
# en .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SEED_EMAIL, SEED_PASSWORD
npm run seed
```

El seed entra como ese usuario y carga `data/tanda-1.json` y `data/tanda-2.json`
(no `tanda-1-grandes.json`, que son empresas descartadas). Es idempotente: podés
correrlo de nuevo sin duplicar. Si no hay plantillas, crea 4 genéricas (una por tipo).
Al final imprime los conteos.

### 5. Probar en local

```bash
npm run dev        # http://localhost:5173/ventas/
```

### 6. Build y publicación en la landing

El build lleva la URL y la anon key de Supabase adentro (no lleva datos: los
prospectos viven en Supabase detrás del login).

```bash
npm run build      # genera dist/
npx vite preview   # opcional: http://localhost:4173/ventas/
```

Copiá el contenido de `dist/` a `collectiq/landing/ventas` (reemplazando lo anterior):

```bash
# Git Bash
rm -rf ../collectiq/landing/ventas
mkdir -p ../collectiq/landing/ventas
cp -r dist/. ../collectiq/landing/ventas/
```

```powershell
# PowerShell
Remove-Item -Recurse -Force ..\collectiq\landing\ventas -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force ..\collectiq\landing\ventas | Out-Null
Copy-Item -Recurse dist\* ..\collectiq\landing\ventas\
```

Después commit y push en el repo de la landing. Queda en `https://fluxcollect.com/ventas/`
(el `index.html` lleva `noindex,nofollow`).

### 7. (Opcional) Regenerar mensajes con Claude

La Edge Function `supabase/functions/regenerar-mensaje` reescribe un mensaje con
`claude-sonnet-5` usando el análisis de la empresa. No guarda nada: devuelve el texto
a la ficha para que lo revises y guardes.

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy regenerar-mensaje
```

Y en `.env`, `VITE_ENABLE_REGENERAR=true` antes del build.

## Cómo funciona el flujo

- **Marcar enviado** registra la actividad y avanza el estado:
  Por invitar → Invitado (invitación), Conectado → Mensaje 1, Mensaje 1 → Follow-up,
  Follow-up → Cierre enviado. Actualiza `ultimo_contacto`.
- **Aceptó**: Invitado → Conectado.
- El **trigger** de la base recalcula `proximo_toque` = hoy + cadencia del nuevo estado
  cada vez que cambia el estado (las cadencias se editan en Ajustes).
- Mensaje mostrado por estado: Por invitar → invitación; Invitado/Conectado → mensaje 1;
  Mensaje 1 → follow-up; Follow-up → cierre. Si el prospecto no tiene texto propio se
  usa una plantilla del segmento o, si no hay, una genérica.
- **Actividades** solo se agregan (la base no permite editarlas ni borrarlas).
- **KPIs**: los contadores salen de las actividades; los ajustes manuales se guardan en
  `kpi_ajustes` para el rango (y segmento, si hay filtro) y se suman al automático.

## Importar Excel/CSV

Columnas reconocidas (primera hoja, encabezados en la primera fila): `empresa`
(obligatoria), `segmento`, `web`, `region`, `tamano`, `score_fit`, `nombre`, `apellido`,
`cargo`, `url_linkedin`, `link_busqueda`, `verificacion`, `estado`, `gancho`,
`msg_invitacion`, `msg_1`, `msg_followup`, `msg_cierre`, `notas`, `fuente`.
Es el mismo formato que exporta el panel. No duplica prospectos (misma empresa +
nombre + apellido + cargo).

## Estructura

```
index.html                 noindex, Barlow, título
vite.config.js             base /ventas/
src/
  main.jsx, App.jsx        HashRouter, login, rutas (pantallas con carga diferida)
  pages/                   Hoy, Dashboard, Pipeline, Prospectos, Ficha, Ajustes, Login
  components/              Layout, modales, tarjetas, gráfico, celdas editables…
  lib/                     supabase, acciones (actividad + estado), kpis, excel,
                           mensajes/plantillas, fechas, configuración, sesión
scripts/seed.mjs           carga inicial
supabase/migrations/       esquema (no editar el inicial; agregar migraciones nuevas)
supabase/functions/        regenerar-mensaje (Deno, Anthropic)
data/                      investigación de prospectos (tandas)
```
