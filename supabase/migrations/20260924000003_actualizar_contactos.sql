-- Flux Prospect: actualización automática de contactos.
--
-- La tarea semanal, con la misma clave de carga (carga_claves), puede:
--   - listar los contactos sin confirmar ('Por verificar' o 'Sin perfil') de
--     prospectos que todavía están 'Por invitar', y
--   - actualizarlos con lo que encontró.
-- Reglas: nunca toca prospectos ya contactados ni contactos 'Verificado',
-- nunca baja la verificación (Sin perfil < Por verificar < Verificado) y, si
-- cambia la persona, exige los cuatro mensajes nuevos (los viejos la nombran).
-- Cada cambio deja en notas lo que había antes. No toca revisar: descartar un
-- prospecto lo borra, y estos ya estaban aprobados.

create or replace function contactos_pendientes(clave text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_owner uuid;
begin
  select c.owner_id into v_owner
    from carga_claves c
   where c.hash = encode(extensions.digest(clave, 'sha256'), 'hex');
  if v_owner is null then
    raise exception 'clave inválida';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id,
             'empresa', jsonb_build_object('nombre', e.nombre, 'segmento', e.segmento, 'web', e.web,
                                           'region', e.region, 'score_fit', e.score_fit),
             'nombre', p.nombre, 'apellido', p.apellido, 'cargo', p.cargo,
             'url_linkedin', p.url_linkedin, 'link_busqueda', p.link_busqueda,
             'verificacion', p.verificacion, 'fuente', p.fuente, 'gancho', p.gancho,
             'mensajes', jsonb_build_object('invitacion', p.msg_invitacion, 'mensaje_1', p.msg_1,
                                            'followup', p.msg_followup, 'cierre', p.msg_cierre))
           order by (p.verificacion = 'Sin perfil') desc, e.score_fit desc nulls last)
      from prospectos p
      left join empresas e on e.id = p.empresa_id
     where p.owner_id = v_owner
       and p.estado = 'Por invitar'
       and p.verificacion <> 'Verificado'
  ), '[]'::jsonb);
end $$;

create or replace function actualizar_contactos_auto(clave text, lote jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_owner uuid;
  item jsonb;
  p prospectos%rowtype;
  v_empresa text;
  v_id uuid;
  v_nombre text;
  v_apellido text;
  v_cargo text;
  v_url text;
  v_busqueda text;
  v_fuente text;
  v_verif text;
  v_inv text;
  v_m1 text;
  v_fu text;
  v_ci text;
  v_otra_persona boolean;
  v_nota text;
  actualizados int := 0;
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
    v_empresa := nullif(btrim(item #>> '{empresa,nombre}'), '');
    v_id := null;
    begin
      v_id := nullif(btrim(item ->> 'id'), '')::uuid;
      if v_id is null then
        rechazados := rechazados || jsonb_build_object('id', null, 'empresa', v_empresa, 'motivo', 'falta id');
        continue;
      end if;

      select * into p from prospectos where id = v_id and owner_id = v_owner for update;
      if not found then
        rechazados := rechazados || jsonb_build_object('id', v_id, 'empresa', v_empresa, 'motivo', 'prospecto inexistente');
        continue;
      end if;
      if p.estado <> 'Por invitar' then
        omitidos := omitidos || jsonb_build_object('id', v_id, 'empresa', v_empresa, 'motivo', format('ya está en %s', p.estado));
        continue;
      end if;
      if p.verificacion = 'Verificado' then
        omitidos := omitidos || jsonb_build_object('id', v_id, 'empresa', v_empresa, 'motivo', 'contacto ya verificado');
        continue;
      end if;

      v_verif := coalesce(nullif(btrim(item ->> 'verificacion'), ''), p.verificacion::text);
      if not (v_verif = any (enum_range(null::verificacion)::text[])) then
        rechazados := rechazados || jsonb_build_object('id', v_id, 'empresa', v_empresa, 'motivo', format('verificación inválida: %s', v_verif));
        continue;
      end if;
      if array_position(array['Sin perfil', 'Por verificar', 'Verificado'], v_verif)
         < array_position(array['Sin perfil', 'Por verificar', 'Verificado'], p.verificacion::text) then
        rechazados := rechazados || jsonb_build_object('id', v_id, 'empresa', v_empresa,
          'motivo', format('no se baja la verificación (%s -> %s)', p.verificacion, v_verif));
        continue;
      end if;

      -- Campos del contacto: si la clave no viene, se conserva lo que había.
      v_nombre   := case when item ? 'nombre'        then nullif(btrim(item ->> 'nombre'), '')        else p.nombre end;
      v_apellido := case when item ? 'apellido'      then nullif(btrim(item ->> 'apellido'), '')      else p.apellido end;
      v_cargo    := case when item ? 'cargo'         then nullif(btrim(item ->> 'cargo'), '')         else p.cargo end;
      v_url      := case when item ? 'url_linkedin'  then nullif(btrim(item ->> 'url_linkedin'), '')  else p.url_linkedin end;
      v_busqueda := case when item ? 'link_busqueda' then nullif(btrim(item ->> 'link_busqueda'), '') else p.link_busqueda end;
      v_fuente   := case when item ? 'fuente'        then nullif(btrim(item ->> 'fuente'), '')        else p.fuente end;

      if v_verif <> 'Sin perfil' and (v_nombre is null or v_apellido is null) then
        rechazados := rechazados || jsonb_build_object('id', v_id, 'empresa', v_empresa,
          'motivo', format('%s sin nombre y apellido', v_verif));
        continue;
      end if;
      if v_verif = 'Verificado' and v_url is null then
        rechazados := rechazados || jsonb_build_object('id', v_id, 'empresa', v_empresa, 'motivo', 'Verificado sin url_linkedin');
        continue;
      end if;
      v_otra_persona := lower(concat_ws(' ', v_nombre, v_apellido))
                        is distinct from lower(concat_ws(' ', p.nombre, p.apellido));

      -- Otra persona u otra verificación: tiene que venir la fuente que lo respalda.
      if v_fuente is null
         or ((v_otra_persona or v_verif <> p.verificacion::text) and v_fuente is not distinct from p.fuente) then
        rechazados := rechazados || jsonb_build_object('id', v_id, 'empresa', v_empresa, 'motivo', 'falta la fuente nueva');
        continue;
      end if;
      v_inv := coalesce(nullif(btrim(item #>> '{mensajes,invitacion}'), ''), case when not v_otra_persona then p.msg_invitacion end);
      v_m1  := coalesce(nullif(btrim(item #>> '{mensajes,mensaje_1}'), ''),  case when not v_otra_persona then p.msg_1 end);
      v_fu  := coalesce(nullif(btrim(item #>> '{mensajes,followup}'), ''),   case when not v_otra_persona then p.msg_followup end);
      v_ci  := coalesce(nullif(btrim(item #>> '{mensajes,cierre}'), ''),     case when not v_otra_persona then p.msg_cierre end);
      if v_otra_persona and (v_inv is null or v_m1 is null or v_fu is null or v_ci is null) then
        rechazados := rechazados || jsonb_build_object('id', v_id, 'empresa', v_empresa,
          'motivo', 'cambió la persona: faltan los cuatro mensajes nuevos');
        continue;
      end if;
      if char_length(coalesce(v_inv, '')) > 300 then
        rechazados := rechazados || jsonb_build_object('id', v_id, 'empresa', v_empresa,
          'motivo', format('invitación de %s caracteres (máximo 300)', char_length(v_inv)));
        continue;
      end if;

      if (v_nombre, v_apellido, v_cargo, v_url, v_busqueda, v_verif, v_fuente, v_inv, v_m1, v_fu, v_ci)
         is not distinct from
         (p.nombre, p.apellido, p.cargo, p.url_linkedin, p.link_busqueda, p.verificacion::text, p.fuente,
          p.msg_invitacion, p.msg_1, p.msg_followup, p.msg_cierre) then
        omitidos := omitidos || jsonb_build_object('id', v_id, 'empresa', v_empresa, 'motivo', 'sin cambios');
        continue;
      end if;

      v_nota := format('[%s] Contacto actualizado automáticamente. Antes: %s, %s, %s.%s',
        to_char(current_date, 'YYYY-MM-DD'),
        coalesce(nullif(concat_ws(' ', p.nombre, p.apellido), ''), 'sin nombre'),
        coalesce(p.cargo, 'sin cargo'),
        p.verificacion,
        case when v_otra_persona then ' Mensajes reescritos para la persona nueva.' else '' end);

      update prospectos set
        nombre = v_nombre, apellido = v_apellido, cargo = v_cargo,
        url_linkedin = v_url, link_busqueda = v_busqueda,
        verificacion = v_verif::verificacion, fuente = v_fuente,
        msg_invitacion = v_inv, msg_1 = v_m1, msg_followup = v_fu, msg_cierre = v_ci,
        notas = concat_ws(E'\n', nullif(notas, ''), v_nota)
      where id = v_id;
      actualizados := actualizados + 1;
    exception when others then
      rechazados := rechazados || jsonb_build_object('id', v_id, 'empresa', v_empresa, 'motivo', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('actualizados', actualizados, 'omitidos', omitidos, 'rechazados', rechazados);
end $$;

revoke execute on function contactos_pendientes(text) from public;
revoke execute on function actualizar_contactos_auto(text, jsonb) from public;
grant execute on function contactos_pendientes(text) to anon, authenticated;
grant execute on function actualizar_contactos_auto(text, jsonb) to anon, authenticated;
