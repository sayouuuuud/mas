-- This function can bootstrap exactly once. Subsequent staff changes go through
-- an authenticated, MFA-verified Owner and are audited by mas_command.
create function public.mas_bootstrap_owner(p_user_id uuid,p_display_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform mas.require_service();
 perform pg_advisory_xact_lock(hashtextextended('mas.owners',0));
 if exists(select 1 from mas.profiles where 'Owner'=any(roles)) then raise exception 'MAS_CONFLICT: owner already initialized';end if;
 if not exists(select 1 from auth.users where id=p_user_id) or length(trim(p_display_name)) not between 2 and 120 then raise exception 'MAS_VALIDATION';end if;
 insert into mas.profiles(id,display_name,roles) values(p_user_id,p_display_name,array['Owner']);
 insert into mas.audit_logs(actor_id,resource,entity_id,action) values(p_user_id,'profiles',p_user_id,'bootstrap_owner');
 return jsonb_build_object('id',p_user_id,'active',true,'roles',jsonb_build_array('Owner'));
end $$;
revoke all on function public.mas_bootstrap_owner(uuid,text) from public,anon,authenticated;
grant execute on function public.mas_bootstrap_owner(uuid,text) to service_role;
