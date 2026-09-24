-- Flux Prospect: país de cada empresa, para separar el panel por países.
--
-- Todo lo cargado hasta ahora es de Argentina (default). La carga automática
-- toma el país de empresa.pais o, si no está, del campo pais del item.

alter table empresas add column if not exists pais text not null default 'Argentina';
create index if not exists empresas_pais_idx on empresas (owner_id, pais);

create or replace function cargar_prospectos_auto(clave text, lote jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_owner uuid;
  item jsonb;
  v_empresa text;
  v_segmento text;
  v_verificacion text;
  v_invitacion text;
  v_empresa_id uuid;
  insertados int := 0;
  omitidos jsonb := '[]'::jsonb;
  rechazados jsonb := '[]'::jsonb;
begin
  select c.owner_id into v_owner
    from carga_claves c
   where c.hash = encode(extensions.digest(clave, 'sha256'), 'hex');
  if v_owner is null then
    raise exception 'clave inválida';
  end if;

  if lote is null or jsonb_typeof(lote) <> 'array' then
    raise exception 'el lote tiene que ser un array';
  end if;
  if jsonb_array_length(lote) > 25 then
    raise exception 'lote demasiado grande: % items (máximo 25)', jsonb_array_length(lote);
  end if;

  for item in select value from jsonb_array_elements(lote) loop
    v_empresa := regexp_replace(btrim(coalesce(item #>> '{empresa,nombre}', '')), '\s+', ' ', 'g');
    begin
      if jsonb_typeof(item) <> 'object' or v_empresa = '' then
        rechazados := rechazados || jsonb_build_object('empresa', nullif(v_empresa, ''), 'motivo', 'falta empresa.nombre');
        continue;
      end if;

      v_segmento := nullif(btrim(item #>> '{empresa,segmento}'), '');
      if v_segmento is not null and not (v_segmento = any (enum_range(null::segmento)::text[])) then
        rechazados := rechazados || jsonb_build_object('empresa', v_empresa, 'motivo', format('segmento inválido: %s', v_segmento));
        continue;
      end if;

      v_verificacion := coalesce(nullif(btrim(item ->> 'verificacion'), ''), 'Por verificar');
      if not (v_verificacion = any (enum_range(null::verificacion)::text[])) then
        rechazados := rechazados || jsonb_build_object('empresa', v_empresa, 'motivo', format('verificación inválida: %s', v_verificacion));
        continue;
      end if;

      v_invitacion := nullif(btrim(item #>> '{mensajes,invitacion}'), '');
      if char_length(coalesce(v_invitacion, '')) > 300 then
        rechazados := rechazados || jsonb_build_object('empresa', v_empresa,
          'motivo', format('invitación de %s caracteres (máximo 300)', char_length(v_invitacion)));
        continue;
      end if;

      -- Empresa ya cargada (sin distinguir mayúsculas ni espacios extra): no se toca.
      if exists (
        select 1 from empresas e
         where e.owner_id = v_owner
           and lower(regexp_replace(btrim(e.nombre), '\s+', ' ', 'g')) = lower(v_empresa)
      ) then
        omitidos := omitidos || jsonb_build_object('empresa', v_empresa, 'motivo', 'empresa existente');
        continue;
      end if;

      insert into empresas (owner_id, nombre, pais, segmento, web, tamano, region, analisis,
                            score_fit, score_justificacion, noticias, fuente)
      values (
        v_owner,
        v_empresa,
        coalesce(nullif(btrim(coalesce(item #>> '{empresa,pais}', item ->> 'pais')), ''), 'Argentina'),
        v_segmento::segmento,
        nullif(btrim(item #>> '{empresa,web}'), ''),
        nullif(btrim(item #>> '{empresa,tamano}'), ''),
        nullif(btrim(item #>> '{empresa,region}'), ''),
        nullif(btrim(item #>> '{empresa,analisis}'), ''),
        round(nullif(btrim(item #>> '{empresa,score_fit}'), '')::numeric)::int,
        nullif(btrim(item #>> '{empresa,score_justificacion}'), ''),
        nullif(btrim(item #>> '{empresa,noticias}'), ''),
        nullif(btrim(item #>> '{empresa,fuente}'), '')
      )
      returning id into v_empresa_id;

      insert into prospectos (owner_id, empresa_id, nombre, apellido, cargo, url_linkedin, link_busqueda,
                              verificacion, fuente, estado, gancho, msg_invitacion, msg_1, msg_followup,
                              msg_cierre, revisar, origen)
      values (
        v_owner,
        v_empresa_id,
        nullif(btrim(item ->> 'nombre'), ''),
        nullif(btrim(item ->> 'apellido'), ''),
        nullif(btrim(item ->> 'cargo'), ''),
        nullif(btrim(item ->> 'url_linkedin'), ''),
        nullif(btrim(item ->> 'link_busqueda'), ''),
        v_verificacion::verificacion,
        nullif(btrim(item ->> 'fuente'), ''),
        'Por invitar',
        nullif(btrim(item ->> 'gancho'), ''),
        v_invitacion,
        nullif(btrim(item #>> '{mensajes,mensaje_1}'), ''),
        nullif(btrim(item #>> '{mensajes,followup}'), ''),
        nullif(btrim(item #>> '{mensajes,cierre}'), ''),
        true,
        coalesce(nullif(btrim(item ->> 'origen'), ''), 'auto')
      );
      insertados := insertados + 1;
    exception when others then
      -- Cualquier otro error (score fuera de rango, tipos, etc.) rechaza solo este item.
      rechazados := rechazados || jsonb_build_object('empresa', nullif(v_empresa, ''), 'motivo', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('insertados', insertados, 'omitidos', omitidos, 'rechazados', rechazados);
end $$;
