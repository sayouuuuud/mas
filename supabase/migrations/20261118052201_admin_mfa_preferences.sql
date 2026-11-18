-- Existing accounts remain MFA-protected. Only a freshly verified, server-side
-- self-service request can change an account's requirement; no client grants.
alter table mas.profiles add column mfa_required boolean not null default true;

create or replace function mas.staff(p_actor uuid,p_aal text default null) returns mas.profiles
language plpgsql stable security definer set search_path='' as $$
declare staff mas.profiles;
begin
 select * into staff from mas.profiles where id=p_actor and active and roles && array['Admin','Owner'];
 if staff.id is null then raise exception 'MAS_FORBIDDEN';end if;
 if staff.mfa_required and coalesce(p_aal,auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'MAS_MFA_REQUIRED';end if;
 return staff;
end $$;

create or replace function public.mas_actor() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare staff mas.profiles;
begin
 select * into staff from mas.profiles where id=auth.uid() and active and roles && array['Admin','Owner'];
 if staff.id is null then raise exception 'MAS_FORBIDDEN';end if;
 return jsonb_build_object('id',staff.id,'active',staff.active,'roles',staff.roles,'displayName',staff.display_name,'mfaEnabled',staff.mfa_required);
end $$;

create function public.mas_set_mfa_requirement(p_actor uuid,p_aal text,p_required boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare staff mas.profiles; previous boolean;
begin
 perform mas.require_service();
 -- Even an opted-out admin must freshly prove possession of a verified factor
 -- before changing this setting. The API verifies the code before calling us.
 if coalesce(p_aal,'aal1')<>'aal2' then raise exception 'MAS_MFA_REQUIRED';end if;
 select * into staff from mas.profiles where id=p_actor and active and roles && array['Admin','Owner'] for update;
 if staff.id is null then raise exception 'MAS_FORBIDDEN';end if;
 if p_required is null then raise exception 'MAS_VALIDATION';end if;
 previous:=staff.mfa_required;
 if previous is distinct from p_required then
  update mas.profiles set mfa_required=p_required,version=version+1,updated_at=now() where id=staff.id;
  insert into mas.audit_logs(actor_id,resource,entity_id,action,detail)
  values(staff.id,'profiles',staff.id,'mfa_requirement_changed',jsonb_build_object('before',previous,'enabled',p_required));
 end if;
 return jsonb_build_object('mfaEnabled',p_required);
end $$;
revoke all on function public.mas_set_mfa_requirement(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.mas_set_mfa_requirement(uuid,text,boolean) to service_role;
