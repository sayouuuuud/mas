insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('quarantine','quarantine',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('catalog-public','catalog-public',true,20971520,array['image/webp','application/pdf']),
 ('catalog-private','catalog-private',false,20971520,array['image/webp','application/pdf']),
 ('sales-private','sales-private',false,20971520,array['application/pdf'])
on conflict(id) do nothing;
-- No INSERT/SELECT policies are granted on storage.objects. Only the backend
-- service key creates scoped upload and short-lived download URLs.

create function public.mas_claim_jobs(p_limit integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform mas.require_service();
 -- Expired leases are reclaimable. An old worker cannot finish the new lease.
 with chosen as (
  select id from mas.jobs where (state='pending' and available_at<=now() or state='running' and lease_until<now()) and attempts<max_attempts
  order by available_at for update skip locked limit least(5,greatest(1,p_limit))
 ), claimed as (
  update mas.jobs j set state='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
  from chosen c where j.id=c.id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseToken',lease_token,'kind',kind,'payload',payload)),'[]') into result from claimed;
 update mas.jobs set state='failed',error_code='LEASE_EXHAUSTED',lease_token=null,lease_until=null where state='running' and lease_until<now() and attempts>=max_attempts;
 delete from mas.rate_limits where resets_at<now()-interval '1 day';
 -- Idempotency entries are intentionally retained: old browser retries must
 -- never create duplicate requests. They contain hashes and opaque references.
 return result;
end $$;

create function public.mas_job_snapshot(p_id uuid,p_lease uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare job mas.jobs;row mas.entities;
begin
 perform mas.require_service();
 select * into job from mas.jobs where id=p_id and state='running' and lease_token=p_lease and lease_until>now();
 if job.id is null then raise exception 'MAS_CONFLICT';end if;
 select * into row from mas.entities where id=job.entity_id;
 if job.kind='quotation_pdf' then return jsonb_build_object('quotation',mas.envelope(row),'customer',row.document->'customerSnapshot','company',row.document->'companySnapshot');end if;
 return mas.envelope(row);
end $$;

create function public.mas_finish_job(p_id uuid,p_lease uuid,p_result jsonb,p_error text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job mas.jobs;row mas.entities;
begin
 perform mas.require_service();
 select * into job from mas.jobs where id=p_id for update;
 if job.id is null or job.state<>'running' or job.lease_token<>p_lease or job.lease_until<=now() then raise exception 'MAS_CONFLICT';end if;
 if p_error is null then
  select * into row from mas.entities where id=job.entity_id for update;
  if job.kind='scan_media' then
   if row.deleted_at is not null or row.document->>'status'<>'quarantined' then raise exception 'MAS_CONFLICT';end if;
   update mas.entities set document=document||mas.pick(p_result,array['path','mime','size','sha256'])||jsonb_build_object('status','ready'),version=version+1,updated_at=now() where id=row.id;
  elsif job.kind='quotation_pdf' then
   update mas.entities set document=document||mas.pick(p_result,array['pdfPath']),version=version+1,updated_at=now() where id=row.id;
  end if;
  update mas.jobs set state='completed',completed_at=now(),lease_token=null,lease_until=null,error_code=null where id=job.id;
 else
  update mas.jobs set state=case when attempts>=max_attempts or p_error in ('INVALID_MEDIA','UNSAFE_FILE') then 'failed' else 'pending' end,error_code=left(p_error,80),available_at=now()+make_interval(secs=>least(3600,30*(2^attempts)::int)),lease_token=null,lease_until=null where id=job.id;
  if job.kind='scan_media' and (job.attempts>=job.max_attempts or p_error in ('INVALID_MEDIA','UNSAFE_FILE')) then update mas.entities set document=document||jsonb_build_object('status','rejected'),version=version+1,updated_at=now() where id=job.entity_id;end if;
 end if;
 return jsonb_build_object('id',job.id,'completed',p_error is null);
end $$;

create function public.mas_reports(p_filters jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare staff mas.profiles;result jsonb;
begin
 staff:=mas.staff(auth.uid());if not mas.allowed(staff,'reports') then raise exception 'MAS_FORBIDDEN';end if;
 with requests as materialized(select e.* from mas.entities e where resource='quote_requests' and mas.can_read(e,staff) and mas.matches(e,p_filters)),
 states as(select document->>'status' status,count(*) count from requests group by 1),
 sources as(select coalesce(document->'source'->>'utmSource','direct') source,count(*) count from requests group by 1)
 select jsonb_build_object('total',(select count(*) from requests),'byStatus',coalesce((select jsonb_object_agg(status,count) from states),'{}'),'bySource',coalesce((select jsonb_object_agg(source,count) from sources),'{}'),'overdueFollowUps',(select count(*) from requests where (document->>'followUpAt')::timestamptz<now() and document->>'status' not in ('won','lost','cancelled')),'unassigned',(select count(*) from requests where document->>'assignedTo' is null)) into result;
 return result;
end $$;

create function public.mas_health() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version','202611160005','ready',
 exists(select 1 from mas.profiles where active and 'Owner'=any(roles)) and
 (public.mas_content('privacy')->>'policyVersion' is not null) and
 exists(select 1 from mas.entities where resource='settings' and deleted_at is null) and
 exists(select 1 from mas.entities where resource='units' and (document->>'active')::boolean and deleted_at is null));
$$;

-- Fixed-path definer functions plus explicit grants avoid the default PUBLIC
-- EXECUTE privilege, including all future functions in the private schema.
alter default privileges in schema mas revoke execute on functions from public;
revoke all on all functions in schema mas from public,anon,authenticated;
revoke all on function public.mas_claim_jobs(integer),public.mas_job_snapshot(uuid,uuid),public.mas_finish_job(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.mas_claim_jobs(integer),public.mas_job_snapshot(uuid,uuid),public.mas_finish_job(uuid,uuid,jsonb,text) to service_role;
revoke all on function public.mas_reports(jsonb) from public,anon;
grant execute on function public.mas_reports(jsonb) to authenticated;
revoke all on function public.mas_health() from public;
grant execute on function public.mas_health() to anon,authenticated;

-- Read-only views make the logical resources easy to inspect in the SQL editor.
do $$ declare resource_name text;begin
 foreach resource_name in array array['products','categories','brands','sectors','units','attributes','contacts','organizations','content','navigation','locations','settings','quote_requests','inquiries','quotations','media'] loop
  execute format('create view mas.%I with (security_invoker=true) as select id,document,version,created_by,created_at,updated_at,deleted_at from mas.entities where resource=%L',resource_name,resource_name);
 end loop;
end $$;
