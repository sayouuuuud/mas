create function public.mas_import_products(p_products jsonb,p_actor uuid,p_aal text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare staff mas.profiles;item jsonb;result jsonb:='[]';
begin
 perform mas.require_service();staff:=mas.staff(p_actor,p_aal);
 if not mas.allowed(staff,'products',true) then raise exception 'MAS_FORBIDDEN';end if;
 if jsonb_array_length(p_products) not between 1 and 200 then raise exception 'MAS_VALIDATION';end if;
 perform pg_advisory_xact_lock(hashtextextended('mas.catalog',0));
 for item in select value from jsonb_array_elements(p_products) loop
  if item->>'status'<>'draft' then raise exception 'MAS_VALIDATION: imported draft';end if;
  result:=result||jsonb_build_array(public.mas_command('products','create',null,null,item,p_actor,p_aal));
 end loop;
 insert into mas.audit_logs(actor_id,resource,action,detail) values(p_actor,'products','import',jsonb_build_object('count',jsonb_array_length(result)));
 return result;
end $$;
create function public.mas_bulk_products(p_action text,p_items jsonb,p_actor uuid,p_aal text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb;result jsonb:='[]';staff mas.profiles;
begin
 perform mas.require_service();staff:=mas.staff(p_actor,p_aal);
 if not mas.allowed(staff,'products',true) then raise exception 'MAS_FORBIDDEN';end if;
 if p_action not in ('archive','unpublish') or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'MAS_VALIDATION';end if;
 perform pg_advisory_xact_lock(hashtextextended('mas.catalog',0));
 for item in select value from jsonb_array_elements(p_items) order by value->>'id' loop
  result:=result||jsonb_build_array(public.mas_command('products',p_action,(item->>'id')::uuid,(item->>'version')::bigint,'{}',p_actor,p_aal));
 end loop;
 return result;
end $$;
revoke all on function public.mas_import_products(jsonb,uuid,text),public.mas_bulk_products(text,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.mas_import_products(jsonb,uuid,text),public.mas_bulk_products(text,jsonb,uuid,text) to service_role;
