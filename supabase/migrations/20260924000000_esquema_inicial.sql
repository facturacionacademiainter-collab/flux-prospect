-- Flux Prospect: esquema inicial.
-- Todo es del usuario logueado (owner_id = auth.uid()); nada es público.

create type segmento as enum (
  'Fintech de crédito', 'Financiera', 'Mutual/Cooperativa',
  'Retail con crédito', 'Automotor', 'Billetera con préstamos'
);

create type estado_prospecto as enum (
  'Por invitar', 'Invitado', 'Conectado', 'Mensaje 1', 'Follow-up',
  'Cierre enviado', 'Respondió', 'Llamada hecha', 'Demo agendada',
  'Demo hecha', 'Diagnóstico en curso', 'Propuesta', 'Cliente', 'No interesado'
);

create type verificacion as enum ('Verificado', 'Por verificar', 'Sin perfil');

create type tipo_actividad as enum (
  'invitación', 'mensaje', 'follow-up', 'llamada', 'email', 'reunión', 'demo', 'propuesta'
);

create type tipo_mensaje as enum ('invitacion', 'mensaje_1', 'followup', 'cierre');

-- Configuración: una fila por usuario. Días de cadencia por estado y metas.
create table configuracion (
  owner_id uuid primary key default auth.uid() references auth.users on delete cascade,
  cadencias jsonb not null default
    '{"Invitado":7,"Mensaje 1":4,"Follow-up":6,"Cierre enviado":60,"Respondió":1}',
  limite_invitaciones_diarias int not null default 25,
  metas_semanales jsonb not null default '{"invitaciones":100,"demos":5}'
);

create table empresas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  segmento segmento,
  web text,
  tamano text,
  analisis text,
  score_fit int check (score_fit between 1 and 100),
  score_justificacion text,
  noticias text,
  fuente text,
  creado_en timestamptz not null default now(),
  unique (owner_id, nombre)
);

create table plantillas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  segmento segmento,
  tipo tipo_mensaje not null,
  cuerpo text not null, -- admite {nombre} {empresa} {gancho}
  creado_en timestamptz not null default now()
);

create table prospectos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  empresa_id uuid references empresas on delete set null,
  nombre text,
  apellido text,
  cargo text,
  url_linkedin text,
  link_busqueda text,
  verificacion verificacion not null default 'Por verificar',
  fuente text,
  estado estado_prospecto not null default 'Por invitar',
  gancho text,
  msg_invitacion text,
  msg_1 text,
  msg_followup text,
  msg_cierre text,
  plantilla_id uuid references plantillas on delete set null,
  ultimo_contacto timestamptz,
  proximo_toque date,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Historial: solo se agrega. Sin UPDATE ni DELETE (ver políticas).
create table actividades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  prospecto_id uuid not null references prospectos on delete cascade,
  tipo tipo_actividad not null,
  fecha timestamptz not null default now(),
  resultado text,
  notas text,
  estado_anterior estado_prospecto,
  estado_nuevo estado_prospecto,
  plantilla_id uuid references plantillas on delete set null
);

create table oportunidades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  prospecto_id uuid not null references prospectos on delete cascade,
  etapa estado_prospecto not null,
  valor_estimado numeric(14,2),
  probabilidad int check (probabilidad between 0 and 100),
  fecha_cierre_estimada date,
  creado_en timestamptz not null default now()
);

-- Ajustes manuales a los KPIs: se suman al valor automático, no lo pisan.
create table kpi_ajustes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  metrica text not null,
  desde date not null,
  hasta date not null,
  valor numeric not null,
  nota text,
  creado_en timestamptz not null default now()
);

create index on prospectos (owner_id, proximo_toque);
create index on prospectos (owner_id, estado);
create index on actividades (prospecto_id, fecha desc);

-- Próximo toque: al cambiar de estado, hoy + días configurados para ese estado.
-- Si el estado no tiene cadencia, queda sin próximo toque.
create function recalcular_proximo_toque() returns trigger
language plpgsql security invoker set search_path = public as $$
declare dias int;
begin
  new.actualizado_en := now();
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    select (c.cadencias ->> new.estado::text)::int into dias
      from configuracion c where c.owner_id = new.owner_id;
    if dias is null then
      dias := ('{"Invitado":7,"Mensaje 1":4,"Follow-up":6,"Cierre enviado":60,"Respondió":1}'::jsonb
               ->> new.estado::text)::int;
    end if;
    new.proximo_toque := case
      when new.estado = 'Por invitar' then current_date
      when dias is null then null
      else current_date + dias end;
  end if;
  return new;
end $$;

create trigger prospectos_proximo_toque
  before insert or update on prospectos
  for each row execute function recalcular_proximo_toque();

-- RLS
alter table configuracion enable row level security;
alter table empresas      enable row level security;
alter table plantillas    enable row level security;
alter table prospectos    enable row level security;
alter table actividades   enable row level security;
alter table oportunidades enable row level security;
alter table kpi_ajustes   enable row level security;

create policy propio on configuracion for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy propio on empresas for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy propio on plantillas for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy propio on prospectos for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy propio on oportunidades for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy propio on kpi_ajustes for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy leer on actividades for select to authenticated
  using (owner_id = auth.uid());
create policy agregar on actividades for insert to authenticated
  with check (owner_id = auth.uid()
    and exists (select 1 from prospectos p where p.id = prospecto_id and p.owner_id = auth.uid()));

revoke all on all tables in schema public from anon;
