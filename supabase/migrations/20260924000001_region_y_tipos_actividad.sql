-- Flux Prospect: ajustes sobre el esquema inicial.

-- 1) Región de la empresa (los JSON de investigación la traen).
alter table empresas add column if not exists region text;

-- 2) Tipos de actividad que el panel registra y la migración inicial no tenía:
--    'respuesta'        -> el prospecto respondió (base de la tasa de respuesta)
--    'aceptación'       -> aceptó la invitación (Invitado -> Conectado)
--    'cambio de estado' -> movimiento manual (kanban, tabla, ficha)
alter type tipo_actividad add value if not exists 'respuesta';
alter type tipo_actividad add value if not exists 'aceptación';
alter type tipo_actividad add value if not exists 'cambio de estado';

-- 3) Cadencia para 'Conectado': 0 días, así el que acepta la invitación
--    entra en la cola de hoy para mandarle el mensaje 1 (sin cadencia quedaba
--    con proximo_toque null y desaparecía de la cola).
alter table configuracion alter column cadencias set default
  '{"Invitado":7,"Conectado":0,"Mensaje 1":4,"Follow-up":6,"Cierre enviado":60,"Respondió":1}';

create or replace function recalcular_proximo_toque() returns trigger
language plpgsql security invoker set search_path = public as $$
declare dias int;
begin
  new.actualizado_en := now();
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    select (c.cadencias ->> new.estado::text)::int into dias
      from configuracion c where c.owner_id = new.owner_id;
    if dias is null then
      dias := ('{"Invitado":7,"Conectado":0,"Mensaje 1":4,"Follow-up":6,"Cierre enviado":60,"Respondió":1}'::jsonb
               ->> new.estado::text)::int;
    end if;
    new.proximo_toque := case
      when new.estado = 'Por invitar' then current_date
      when dias is null then null
      else current_date + dias end;
  end if;
  return new;
end $$;
