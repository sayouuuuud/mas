-- ============================================================================
-- 202611170001_admin_jobs_and_safeguards.sql
-- Single Admin role compatibility (keeping Owner internally), job status
-- metadata on private reads, safe job retry RPC, product draft-only deletion
-- protection, superseded quotation revisions, and audit log filtering.
-- ============================================================================

alter table mas.profiles drop constraint if exists profiles_roles_check;
alter table mas.profiles add constraint profiles_roles_check
  check(cardinality(roles)>0 and roles <@ array['Admin','Owner','Catalog Manager','Content Editor','Sales Manager','Sales Agent']);

create or replace function mas.staff(p_actor uuid,p_aal text default null) returns mas.profiles
language plpgsql stable security definer set search_path='' as $$
declare staff mas.profiles; level text;
begin
 select * into staff from mas.profiles where id=p_actor and active;
 if staff.id is null then raise exception 'MAS_FORBIDDEN';end if;
 level:=coalesce(p_aal,auth.jwt()->>'aal','aal1');
 if staff.roles && array['Admin','Owner','Sales Manager'] and level<>'aal2' then raise exception 'MAS_MFA_REQUIRED';end if;
 return staff;
end $$;

create or replace function mas.allowed(p_staff mas.profiles,p_resource text,p_write boolean default false) returns boolean
language sql immutable set search_path='' as $$
 select (p_staff.roles && array['Admin','Owner']) or case
 when p_resource in ('products','categories','brands','sectors','units','attributes') then
   p_staff.roles && (case when p_write then array['Catalog Manager'] else array['Catalog Manager','Sales Manager','Sales Agent','Content Editor'] end)
 when p_resource='media' then p_staff.roles && array['Catalog Manager','Content Editor']
 when p_resource in ('content','navigation','locations') then 'Content Editor'=any(p_staff.roles)
 when p_resource in ('contacts','organizations','quote_requests','inquiries','quotations','request_events','quotation_events','reports') then p_staff.roles && array['Sales Manager','Sales Agent']
 else false end;
$$;

create or replace function mas.can_read(p_entity mas.entities,p_staff mas.profiles) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare request_row mas.entities;
begin
 if p_staff.id is null or not mas.allowed(p_staff,p_entity.resource) then return false;end if;
 if p_staff.roles && array['Admin','Owner','Sales Manager'] or p_entity.resource not in ('quote_requests','inquiries','quotations','contacts','organizations') then return true;end if;
 if p_entity.resource in ('quote_requests','inquiries') then return p_entity.document->>'assignedTo'=p_staff.id::text;end if;
 if p_entity.resource='quotations' then select * into request_row from mas.entities where id=(p_entity.document->>'requestId')::uuid;return request_row.document->>'assignedTo'=p_staff.id::text;end if;
 if p_entity.resource='contacts' then return p_entity.created_by=p_staff.id or exists(select 1 from mas.entities e where e.resource in ('quote_requests','inquiries') and e.deleted_at is null and e.document->>'assignedTo'=p_staff.id::text and e.document->>'contactId'=p_entity.id::text);end if;
 return exists(select 1 from mas.entities e where e.resource='contacts' and e.document->>'organizationId'=p_entity.id::text and mas.can_read(e,p_staff));
end $$;

create or replace function mas.job_meta(p_entity mas.entities) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare job mas.jobs;
begin
 if p_entity.resource='quotations' then
  if p_entity.document->>'pdfPath' is not null then
   return jsonb_build_object('pdfStatus','ready','pdfError',null);
  elsif p_entity.document->>'status'='draft' then
   return jsonb_build_object('pdfStatus','none','pdfError',null);
  end if;
  select * into job from mas.jobs where entity_id=p_entity.id and kind='quotation_pdf' order by created_at desc limit 1;
  if job.id is null then
   return jsonb_build_object('pdfStatus','failed','pdfError','JOB_MISSING');
  elsif job.state='failed' then
   return jsonb_build_object('pdfStatus','failed','pdfError',coalesce(job.error_code,'PROCESSING_FAILED'));
  else
   return jsonb_build_object('pdfStatus','processing','pdfError',job.error_code,'pdfAttempts',job.attempts);
  end if;
 elsif p_entity.resource='media' then
  select * into job from mas.jobs where entity_id=p_entity.id and kind='scan_media' order by created_at desc limit 1;
  if job.id is not null then
   return jsonb_build_object('scanState',job.state,'scanAttempts',job.attempts,'scanError',job.error_code);
  end if;
 elsif p_entity.resource='quote_requests' then
  return jsonb_build_object('itemCount',(select count(*)::int from mas.sales_items i where i.request_id=p_entity.id));
 end if;
 return '{}'::jsonb;
end $$;

create or replace function mas.public_entity(p_entity mas.entities) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; variants jsonb;
begin
 if p_entity.deleted_at is not null then return null;end if;
 if p_entity.resource='content' and p_entity.published_document is not null then p_entity.document:=p_entity.published_document;end if;
 if p_entity.resource in ('products','categories','brands','sectors','content') and p_entity.document->>'status'<>'published' then return null;end if;
 if p_entity.resource='products' then
  result:=mas.pick(mas.envelope(p_entity),array['id','slug','name','summary','description','applications','benefits','categoryId','brandId','family','featured','modelCode','mainMediaId','sectorIds','relatedIds','specifications','seoTitle','seoDescription','publishedAt','status']);
  select coalesce(jsonb_agg(mas.pick(v.document,array['label','sku','manufacturerPartNumber','unitId','minQuantity','quantityStep','packQuantity','packUnitId','availability','specifications']) || jsonb_build_object('id',v.id,'active',true,'media',mas.public_media(v.document->'mediaIds')) order by coalesce((v.document->>'order')::int,0),v.sku),'[]') into variants from mas.variants v where v.product_id=p_entity.id and v.active and v.retired_at is null;
  return result || jsonb_build_object('variants',variants,'media',mas.public_media(coalesce(p_entity.document->'mediaIds','[]')||jsonb_build_array(p_entity.document->'mainMediaId')));
 elsif p_entity.resource in ('categories','brands','sectors') then
  return mas.pick(mas.envelope(p_entity),array['id','name','slug','description','parentId','family','logoMediaId','imageMediaId','website','order','seoTitle','seoDescription','status'])||jsonb_build_object('media',mas.public_media(jsonb_build_array(p_entity.document->'logoMediaId',p_entity.document->'imageMediaId')));
 elsif p_entity.resource='content' then return mas.pick(mas.envelope(p_entity),array['id','key','name','body','ctaLabel','ctaPath','policyVersion','seoTitle','seoDescription','status'])||jsonb_build_object('media',mas.public_media(p_entity.document->'mediaIds'));
 elsif p_entity.resource='navigation' and (p_entity.document->>'active')::boolean then return mas.pick(mas.envelope(p_entity),array['id','name','path','area','order']);
 elsif p_entity.resource='locations' and (p_entity.document->>'published')::boolean then return mas.pick(mas.envelope(p_entity),array['id','name','kind','address','phone','mapUrl','hours']);
 elsif p_entity.resource='settings' then return mas.pick(mas.envelope(p_entity),array['id','name','email','phone','whatsapp','support','currency','timezone','responseTarget']);
 elsif p_entity.resource='units' and (p_entity.document->>'active')::boolean then return mas.pick(mas.envelope(p_entity),array['id','name','code','precision']);
 elsif p_entity.resource='attributes' then return mas.pick(mas.envelope(p_entity),array['id','name','code','type','scope','unitId','filterable','options','categories']);
 end if;
 return null;
end $$;

create or replace function public.mas_content(p_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_key in ('navigation','locations','settings','units','attributes') then
  select jsonb_build_object('items',coalesce(jsonb_agg(mas.public_entity(e) order by coalesce((e.document->>'order')::int,0)) filter(where mas.public_entity(e) is not null),'[]')) into result from mas.entities e where resource=p_key and deleted_at is null;return result;
 end if;
 select mas.public_entity(e) into result from mas.entities e where resource='content' and document->>'key'=p_key and deleted_at is null;return result;
end $$;

create or replace function mas.matches(p_entity mas.entities,p_filters jsonb,p_public boolean default false) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare doc jsonb:=p_entity.document;q text:=lower(coalesce(p_filters->>'q',''));
begin
 if p_entity.deleted_at is not null then return false;end if;
 if p_filters->>'status' is not null and doc->>'status' is distinct from p_filters->>'status' then return false;end if;
 if p_filters->>'requestId' is not null and doc->>'requestId' is distinct from p_filters->>'requestId' then return false;end if;
 if p_filters->>'assignedTo' is not null then
  if p_entity.resource in ('quote_requests','inquiries') and doc->>'assignedTo' is distinct from p_filters->>'assignedTo' then return false;end if;
  if p_entity.resource='quotations' and not exists(select 1 from mas.entities r where r.id::text=doc->>'requestId' and r.document->>'assignedTo'=p_filters->>'assignedTo') then return false;end if;
 end if;
 if p_filters->>'from' is not null and p_entity.created_at::date<(p_filters->>'from')::date then return false;end if;
 if p_filters->>'to' is not null and p_entity.created_at::date>(p_filters->>'to')::date then return false;end if;
 if q<>'' and position(q in lower(coalesce((case when p_public then mas.public_entity(p_entity) else doc end)::text,'')||p_entity.id::text))=0 then return false;end if;
 if jsonb_array_length(coalesce(p_filters->'category','[]'))>0 and not exists(
  with recursive cats(id) as (
   select e.id from mas.entities e where e.resource='categories' and e.deleted_at is null and (e.id::text in(select jsonb_array_elements_text(p_filters->'category')) or e.document->>'slug' in(select jsonb_array_elements_text(p_filters->'category')))
   union select e.id from mas.entities e join cats c on e.document->>'parentId'=c.id::text where e.resource='categories' and e.deleted_at is null
  ) select 1 from cats where id::text=doc->>'categoryId'
 ) then return false;end if;
 if jsonb_array_length(coalesce(p_filters->'brand','[]'))>0 and not exists(
  select 1 from mas.entities b where b.resource='brands' and b.deleted_at is null and b.id::text=doc->>'brandId' and (b.id::text in(select jsonb_array_elements_text(p_filters->'brand')) or b.document->>'slug' in(select jsonb_array_elements_text(p_filters->'brand')))
 ) then return false;end if;
 if jsonb_array_length(coalesce(p_filters->'sector','[]'))>0 and not exists(
  select 1 from mas.entities s where s.resource='sectors' and s.deleted_at is null and coalesce(doc->'sectorIds','[]') ? s.id::text and (s.id::text in(select jsonb_array_elements_text(p_filters->'sector')) or s.document->>'slug' in(select jsonb_array_elements_text(p_filters->'sector')))
 ) then return false;end if;
 if jsonb_array_length(coalesce(p_filters->'availability','[]'))>0 and not exists(select 1 from mas.variants where product_id=p_entity.id and active and retired_at is null and p_filters->'availability' ? (document->>'availability')) then return false;end if;
 if jsonb_array_length(coalesce(p_filters->'pack','[]'))>0 and not exists(select 1 from mas.variants where product_id=p_entity.id and active and retired_at is null and p_filters->'pack' ? (document->>'packQuantity')) then return false;end if;
 if p_filters->>'attribute' is not null and not exists(
  select 1 from (
   select s from jsonb_array_elements(coalesce(doc->'specifications','[]')) s
   union all select s from mas.variants v cross join lateral jsonb_array_elements(coalesce(v.document->'specifications','[]')) s where v.product_id=p_entity.id and v.active and v.retired_at is null
  ) values_for_attribute where s->>'attributeId'=p_filters->>'attribute' and (p_filters->>'value' is null or s->>'value'=p_filters->>'value' or s->'value' ? (p_filters->>'value'))
 ) then return false;end if;
 return true;
end $$;

create or replace function public.mas_get(p_resource text,p_id text,p_private boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare row mas.entities;staff mas.profiles;result jsonb;
begin
 if p_private then staff:=mas.staff(auth.uid());end if;
 if p_resource='profiles' and p_private then
  if not (staff.roles && array['Admin','Owner','Sales Manager']) then raise exception 'MAS_FORBIDDEN';end if;
  select jsonb_build_object('id',p.id,'email',u.email,'displayName',p.display_name,'roles',p.roles,'active',p.active,'version',p.version,'createdAt',p.created_at,'updatedAt',p.updated_at) into result from mas.profiles p left join auth.users u on u.id=p.id where p.id::text=p_id;return result;
 end if;
 select * into row from mas.entities where resource=p_resource and deleted_at is null and (id::text=p_id or document->>'slug'=p_id);
 if row.id is null then return null;end if;
 if p_private then
  if not mas.can_read(row,staff) then return null;end if;
  result:=mas.envelope(row)||mas.job_meta(row);
  if p_resource in ('quote_requests','inquiries') then
   result:=result||jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'variantId',i.variant_id,'unitId',i.unit_id,'quantity',i.quantity,'snapshot',i.snapshot,'notes',i.notes) order by position) from mas.sales_items i where request_id=row.id),'[]'),'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',kind,'detail',detail,'actorId',actor_id,'createdAt',created_at) order by created_at) from mas.events e where entity_id=row.id),'[]'));
  elsif p_resource='quotations' then
   result:=result||jsonb_build_object('events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',kind,'detail',detail,'actorId',actor_id,'createdAt',created_at) order by created_at) from mas.events e where entity_id=row.id),'[]'));
  end if;
  return result;
 end if;
 return mas.public_entity(row);
end $$;

create or replace function public.mas_list(p_resource text,p_filters jsonb default '{}',p_private boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare staff mas.profiles;count_rows bigint;rows jsonb;page integer:=greatest(1,coalesce((p_filters->>'page')::int,1));size integer:=least(1000,greatest(1,coalesce((p_filters->>'pageSize')::int,24)));q text:=lower(trim(coalesce(p_filters->>'q','')));
begin
 if p_private then staff:=mas.staff(auth.uid());end if;
 if p_private and p_resource='profiles' then
  if not (staff.roles && array['Admin','Owner']) then raise exception 'MAS_FORBIDDEN';end if;
  return (
   with filtered as (
    select p.*,u.email from mas.profiles p left join auth.users u on u.id=p.id
    where (q='' or position(q in lower(p.display_name||' '||coalesce(u.email,'')||' '||p.id::text||' '||array_to_string(p.roles,' ')))>0)
      and (p_filters->>'status' is null or (p_filters->>'status'='active' and p.active) or (p_filters->>'status'='inactive' and not p.active))
   )
   select jsonb_build_object(
    'data',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'email',p.email,'version',p.version,'displayName',p.display_name,'active',p.active,'roles',p.roles,'createdAt',p.created_at,'updatedAt',p.updated_at)) from (select * from filtered order by created_at limit size offset (page-1)*size) p),'[]'),
    'total',(select count(*) from filtered)
   )
  );
 elsif p_private and p_resource='audit_logs' then
  if not (staff.roles && array['Admin','Owner']) then raise exception 'MAS_FORBIDDEN';end if;
  return (
   with filtered as (
    select * from mas.audit_logs a
    where (q='' or position(q in lower(coalesce(a.resource,'')||' '||coalesce(a.action,'')||' '||coalesce(a.entity_id::text,'')||' '||coalesce(a.actor_id::text,'')))>0)
      and (p_filters->>'from' is null or a.created_at::date>=(p_filters->>'from')::date)
      and (p_filters->>'to' is null or a.created_at::date<=(p_filters->>'to')::date)
   )
   select jsonb_build_object(
    'data',coalesce((select jsonb_agg(to_jsonb(a)) from (select * from filtered order by created_at desc limit size offset (page-1)*size) a),'[]'),
    'total',(select count(*) from filtered)
   )
  );
 end if;
 if p_private and not mas.allowed(staff,p_resource) then raise exception 'MAS_FORBIDDEN';end if;
 with eligible as materialized (
 select e,case when p_private then mas.envelope(e)||mas.job_meta(e) else mas.public_entity(e) end as projected
 from mas.entities e where resource=p_resource and mas.matches(e,p_filters,not p_private) and (not p_private or mas.can_read(e,staff))
 ), visible as materialized (select * from eligible where projected is not null), selected as (
 select projected from visible order by
  case when coalesce(p_filters->>'sort','featured')='featured' then coalesce(((e).document->>'featured')::boolean,false) end desc nulls last,
  case when p_filters->>'sort'='name' then (e).document->'name'->>coalesce(p_filters->>'locale','ar') end asc nulls last,
  (e).created_at desc,(e).id
 limit size offset (page-1)*size
 ) select (select count(*) from visible),coalesce(jsonb_agg(projected),'[]') into count_rows,rows from selected;
 return jsonb_build_object('data',rows,'total',count_rows);
end $$;

create or replace function public.mas_command(p_resource text,p_action text,p_id uuid,p_version bigint,p_data jsonb,p_actor uuid,p_aal text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare staff mas.profiles;row mas.entities;old_row mas.entities;other mas.entities;target mas.profiles;invitation mas.invitations;result jsonb;doc jsonb;new_id uuid;new_status text;allowed text[];number_value text;series text;rev int;field text;item jsonb;
begin
 perform mas.require_service();staff:=mas.staff(p_actor,p_aal);
 if p_resource in ('products','categories','brands','sectors','units','attributes','media','content') then perform pg_advisory_xact_lock(hashtextextended('mas.catalog',0));end if;
 if p_resource='audit_logs' and p_action='export' then
  if not mas.allowed(staff,p_data->>'resource') or (p_data->>'resource'<>'products' and not (staff.roles && array['Admin','Owner','Sales Manager'])) then raise exception 'MAS_FORBIDDEN';end if;
  insert into mas.audit_logs(actor_id,resource,action,detail) values(staff.id,p_data->>'resource','export',jsonb_build_object('count',p_data->'count')) returning jsonb_build_object('id',id,'version',1) into result;return result;
 end if;
 if p_resource='profiles' then
  if not (staff.roles && array['Admin','Owner']) then raise exception 'MAS_FORBIDDEN';end if;
  perform pg_advisory_xact_lock(hashtextextended('mas.owners',0));
  if p_action='prepare_invitation' then
   insert into mas.invitations(email,display_name,roles,invited_by) values(lower(p_data->>'email'),p_data->>'displayName',array(select jsonb_array_elements_text(p_data->'roles')),staff.id) on conflict(lower(email)) where status='pending' do update set display_name=excluded.display_name,roles=excluded.roles,invited_by=excluded.invited_by,expires_at=now()+interval '1 day' returning * into invitation;
   result:=jsonb_build_object('id',invitation.id,'version',1,'status','pending');
  elsif p_action='confirm_invitation' then
   select * into invitation from mas.invitations where id=(p_data->>'invitationId')::uuid and status='pending' and expires_at>now() for update;
   if invitation.id is null then raise exception 'MAS_VALIDATION: invitation';end if;
   if not exists(select 1 from auth.users where id=p_id and lower(email)=invitation.email) then raise exception 'MAS_VALIDATION: invitation identity';end if;
   insert into mas.profiles(id,display_name,roles) values(p_id,invitation.display_name,invitation.roles) returning * into target;
   update mas.invitations set status='confirmed' where id=invitation.id;
   result:=jsonb_build_object('id',target.id,'version',target.version,'active',target.active,'roles',target.roles,'displayName',target.display_name);
  elsif p_action='update_staff' then
   select * into target from mas.profiles where id=p_id for update;
   if target.id is null then raise exception 'MAS_NOT_FOUND';end if;
   if target.version<>p_version then raise exception 'MAS_CONFLICT';end if;
   if target.id=staff.id and (not (p_data->>'active')::boolean or not ((p_data->'roles' ? 'Owner') or (p_data->'roles' ? 'Admin'))) then raise exception 'MAS_VALIDATION: self protection';end if;
   if target.active and (target.roles && array['Admin','Owner']) and (not (p_data->>'active')::boolean or not ((p_data->'roles' ? 'Owner') or (p_data->'roles' ? 'Admin'))) and not exists(select 1 from mas.profiles where id<>target.id and active and roles && array['Admin','Owner']) then raise exception 'MAS_VALIDATION: last owner';end if;
   update mas.profiles set display_name=p_data->>'displayName',roles=array(select jsonb_array_elements_text(p_data->'roles')),active=(p_data->>'active')::boolean,version=version+1,updated_at=now() where id=target.id returning * into target;
   result:=jsonb_build_object('id',target.id,'version',target.version,'active',target.active,'roles',target.roles,'displayName',target.display_name);
  else raise exception 'MAS_VALIDATION: staff action';end if;
  insert into mas.audit_logs(actor_id,resource,entity_id,action) values(staff.id,'profiles',p_id,p_action);return result;
 end if;
 if not mas.allowed(staff,p_resource,true) then raise exception 'MAS_FORBIDDEN';end if;
 if p_id is not null then
  select * into row from mas.entities where id=p_id and resource=p_resource and deleted_at is null for update;
  if row.id is null or not mas.can_read(row,staff) then raise exception 'MAS_NOT_FOUND';end if;
  if p_version is null or row.version<>p_version then raise exception 'MAS_CONFLICT';end if;
  old_row:=row;
 end if;
 if p_resource='attributes' and p_action in ('create','update') and mas.pick(coalesce(row.document,'{}'),array['type','scope','unitId','categories','options'])<>mas.pick(p_data,array['type','scope','unitId','categories','options']) then
  if exists(select 1 from mas.entity_links l join mas.entities e on e.id=l.source_id where l.target_id=p_id and e.document->>'status'='published' and e.deleted_at is null) then raise exception 'MAS_VALIDATION: unpublish dependent products before changing specification rules';end if;
  for item in select value from jsonb_array_elements(coalesce(p_data->'categories','[]')) where (value->>'required')::boolean loop
   if exists(with recursive cats(id) as(select (item->>'categoryId')::uuid union select e.id from mas.entities e join cats c on e.document->>'parentId'=c.id::text where e.resource='categories' and e.deleted_at is null) select 1 from mas.entities p join cats c on p.document->>'categoryId'=c.id::text where p.resource='products' and p.document->>'status'='published' and p.deleted_at is null) then raise exception 'MAS_VALIDATION: review published products before adding required specifications';end if;
  end loop;
 end if;
 if p_action='create' then
  if p_id is not null or p_resource in ('quote_requests','inquiries') then raise exception 'MAS_VALIDATION: create';end if;
  doc:=p_data;
  if p_resource in ('products','categories','brands','sectors','content') and doc->>'status'<>'draft' then raise exception 'MAS_VALIDATION: draft';end if;
  if p_resource='media' then doc:=doc||jsonb_build_object('status','uploading');end if;
  if p_resource='quotations' then
   select * into other from mas.entities where id=(doc->>'requestId')::uuid and resource='quote_requests' and deleted_at is null;
   if other.id is null or not mas.can_read(other,staff) then raise exception 'MAS_NOT_FOUND';end if;
   new_id:=gen_random_uuid();doc:=doc||jsonb_build_object('status','draft','revision',1,'seriesId',new_id,'customerSnapshot',other.document->'customerSnapshot');
  end if;
  if p_resource='attributes' then
   select coalesce(jsonb_agg(o||jsonb_build_object('id',coalesce(o->>'id',gen_random_uuid()::text))),'[]') into item from jsonb_array_elements(coalesce(doc->'options','[]')) o;doc:=jsonb_set(doc,'{options}',item);
  end if;
  insert into mas.entities(id,resource,document,created_by) values(coalesce(new_id,(case when p_resource='media' then (doc->>'id')::uuid end),gen_random_uuid()),p_resource,doc-'id',staff.id) returning * into row;
 elsif row.id is null then raise exception 'MAS_NOT_FOUND';
 elsif p_action='update' then
  if p_resource in ('quote_requests','inquiries') or (p_resource='quotations' and row.document->>'status'<>'draft') then raise exception 'MAS_VALIDATION: immutable';end if;
  doc:=p_data;
  if p_resource in ('products','categories','brands','sectors') and doc->>'status' is distinct from row.document->>'status' then raise exception 'MAS_VALIDATION: use publication action';end if;
  if p_resource='categories' and mas.pick(doc,array['parentId','family'])<>mas.pick(row.document,array['parentId','family']) and exists(select 1 from mas.entity_links l join mas.entities e on e.id=l.source_id where l.target_id=row.id and e.document->>'status'='published' and e.deleted_at is null) then raise exception 'MAS_VALIDATION: published category structure';end if;
  if p_resource='content' then doc:=doc||jsonb_build_object('status','draft');end if;
  if p_resource='units' and (doc->>'active'='false' or mas.pick(doc,array['code','precision'])<>mas.pick(row.document,array['code','precision'])) and exists(select 1 from mas.entity_links l join mas.entities e on e.id=l.source_id where l.target_id=row.id and e.deleted_at is null and e.document->>'status'='published') then raise exception 'MAS_VALIDATION: active dependency';end if;
  if p_resource='quotations' then
   if doc->>'requestId'<>row.document->>'requestId' then raise exception 'MAS_VALIDATION: quotation request';end if;
   doc:=doc||mas.pick(row.document,array['status','revision','seriesId','number','customerSnapshot']);
  elsif p_resource='media' then
   doc:=row.document||mas.pick(p_data,array['name','alt']);
   if (coalesce(doc->'alt'->>'ar','')='' or coalesce(doc->'alt'->>'en','')='') and exists(select 1 from mas.entity_links l join mas.entities e on e.id=l.source_id where l.target_id=row.id and l.kind='main_media' and e.deleted_at is null and e.document->>'status'='published') then raise exception 'MAS_VALIDATION: published alt text';end if;
  end if;
  row.document:=doc;
 elsif p_action in ('publish','unpublish','archive') and p_resource in ('products','categories','brands','sectors','content') then
  new_status:=case p_action when 'publish' then 'published' when 'archive' then 'archived' else 'draft' end;
  if new_status<>'published' and exists(select 1 from mas.entity_links l join mas.entities e on e.id=l.source_id where l.target_id=row.id and l.kind<>'related' and e.deleted_at is null and e.document->>'status'='published') then raise exception 'MAS_VALIDATION: published dependency';end if;
  row.document:=row.document||jsonb_build_object('status',new_status,'publishedAt',case when new_status='published' then to_jsonb(now()) else row.document->'publishedAt' end);
  if p_resource='content' then
   if new_status='published' and row.document->>'key'='privacy' then
    if coalesce(row.document->>'policyVersion','')='' then raise exception 'MAS_VALIDATION: policy version';end if;
    doc:=mas.pick(row.document,array['name','body','policyVersion']);
    insert into mas.policy_versions(version,content) values(row.document->>'policyVersion',doc) on conflict(version) do nothing;
    if (select content from mas.policy_versions where version=row.document->>'policyVersion')<>doc then raise exception 'MAS_VALIDATION: immutable policy version';end if;
   end if;
   row.published_document:=case when new_status='published' then row.document else null end;
  end if;
 elsif p_action='delete' then
  if p_resource in ('quote_requests','inquiries','quotations') then raise exception 'MAS_VALIDATION: retained history';end if;
  if p_resource='products' and row.document->>'status'<>'draft' then raise exception 'MAS_VALIDATION: draft only';end if;
  if exists(select 1 from mas.entity_links l join mas.entities e on e.id=l.source_id where l.target_id=row.id and e.deleted_at is null)
     or exists(select 1 from mas.sales_items where unit_id=row.id)
     or (p_resource='products' and exists(select 1 from mas.sales_items si join mas.variants v on v.id=si.variant_id where v.product_id=row.id)) then
   raise exception 'MAS_VALIDATION: dependencies';
  end if;
  if p_resource='media' and row.document->>'status'='ready' then insert into mas.jobs(kind,entity_id,payload) values('delete_media',row.id,jsonb_build_object('path',row.document->>'path','bucket',case when row.document->>'visibility'='public' then 'catalog-public' else 'catalog-private' end));end if;
  row.deleted_at:=now();
  if p_resource='products' then update mas.variants set active=false,retired_at=now() where product_id=row.id;end if;
 elsif p_action='assign' and p_resource in ('quote_requests','inquiries') then
  if not (staff.roles && array['Admin','Owner','Sales Manager']) then raise exception 'MAS_FORBIDDEN';end if;
  if p_data->>'assignedTo' is not null then
   select * into target from mas.profiles where id=(p_data->>'assignedTo')::uuid and active and roles && array['Admin','Owner','Sales Manager','Sales Agent'];
   if target.id is null then raise exception 'MAS_VALIDATION: assignee';end if;
  end if;
  row.document:=row.document||jsonb_build_object('assignedTo',p_data->'assignedTo');
  if row.document->>'status' in ('new','assigned') then row.document:=row.document||jsonb_build_object('status',case when target.id is null then 'new' else 'assigned' end);end if;
 elsif p_action='update_follow_up' and p_resource in ('quote_requests','inquiries') then
  if p_data->>'contactId' is not null then other:=mas.reference((p_data->>'contactId')::uuid,'contacts');if not mas.can_read(other,staff) then raise exception 'MAS_NOT_FOUND';end if;end if;
  row.document:=row.document||mas.pick(p_data,array['priority','followUpAt','contactId']);
 elsif p_action='note' and p_resource in ('quote_requests','inquiries') then
  if length(trim(p_data->>'body')) not between 2 and 2000 then raise exception 'MAS_VALIDATION: note';end if;
 elsif p_action='transition' and p_resource in ('quote_requests','inquiries') then
  new_status:=p_data->>'status';
  if p_resource='quote_requests' then
   allowed:=case row.document->>'status' when 'new' then array['assigned','lost','cancelled'] when 'assigned' then array['in_progress','lost','cancelled'] when 'in_progress' then array['awaiting_customer','quoted','lost','cancelled'] when 'awaiting_customer' then array['in_progress','quoted','lost','cancelled'] when 'quoted' then array['in_progress','won','lost','cancelled'] else array['in_progress'] end;
   if new_status='quoted' and not exists(select 1 from mas.entities where resource='quotations' and document->>'requestId'=row.id::text and (document->>'status'='sent' or document->'delivery' is not null)) then raise exception 'MAS_VALIDATION: delivered quotation';end if;
  else allowed:=case row.document->>'status' when 'new' then array['assigned','spam'] when 'assigned' then array['in_progress','spam'] when 'in_progress' then array['resolved','spam'] else array['in_progress'] end;end if;
  if not new_status=any(allowed) then raise exception 'MAS_VALIDATION: transition';end if;
  if row.document->>'status' in ('won','lost','cancelled','resolved','spam') and not (staff.roles && array['Admin','Owner','Sales Manager']) then raise exception 'MAS_FORBIDDEN';end if;
  if (new_status in ('won','lost','cancelled','resolved','spam','awaiting_customer') or row.document->>'status' in ('won','lost','cancelled','resolved','spam')) and length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'MAS_VALIDATION: reason';end if;
  if new_status='assigned' and row.document->>'assignedTo' is null then raise exception 'MAS_VALIDATION: assignee';end if;
  row.document:=row.document||jsonb_build_object('status',new_status);
 elsif p_action='convert' and p_resource='inquiries' then
  if row.document->>'convertedRequestId' is not null or row.document->>'status'='spam' then raise exception 'MAS_VALIDATION: conversion';end if;
  perform pg_advisory_xact_lock(hashtextextended('mas.catalog',0));
  number_value:='RFQ-'||to_char(now() at time zone 'Africa/Cairo','YYYY')||'-'||lpad(nextval('mas.rfq_sequence')::text,7,'0');
  insert into mas.entities(resource,document,created_by) values('quote_requests',mas.pick(row.document,array['locale','customerSnapshot','assignedTo','contactId','source','priority'])||jsonb_build_object('reference',number_value,'status',case when row.document->>'assignedTo' is null then 'new' else 'assigned' end,'sourceInquiryId',row.id),staff.id) returning * into other;
  perform mas.store_items(other.id,p_data->'items');insert into mas.consents(entity_id,policy_version,accepted_at,source_page,locale) select other.id,policy_version,accepted_at,source_page,locale from mas.consents where entity_id=row.id;row.document:=row.document||jsonb_build_object('convertedRequestId',other.id,'status','resolved');
  insert into mas.events(entity_id,actor_id,kind,detail) values(other.id,staff.id,'converted',jsonb_build_object('inquiryId',row.id));
 elsif p_resource='quotations' and p_action in ('issue','revise','sent','accepted','rejected','expired') then
  if p_action='issue' then
   if row.document->>'status'<>'draft' or (row.document->>'validUntil')::date<(now() at time zone 'Africa/Cairo')::date or length(trim(row.document->>'terms'))=0 or length(trim(row.document->>'leadTime'))=0 then raise exception 'MAS_VALIDATION: issue';end if;
   number_value:=coalesce(row.document->>'number','Q-'||to_char(now() at time zone 'Africa/Cairo','YYYY')||'-'||lpad(nextval('mas.quotation_sequence')::text,7,'0'));
   select * into other from mas.entities where resource='settings' and deleted_at is null order by created_at limit 1;
   if other.id is null then raise exception 'MAS_VALIDATION: company settings';end if;
   row.document:=row.document||jsonb_build_object('status','issued','number',number_value,'issuedAt',now(),'companySnapshot',other.document);
   if row.document->>'seriesId' is not null then
    update mas.entities
    set document=document||jsonb_build_object('status','superseded'),version=version+1,updated_at=now()
    where resource='quotations' and deleted_at is null and id<>row.id and document->>'seriesId'=row.document->>'seriesId' and document->>'status' in ('issued','sent');
   end if;
   insert into mas.jobs(kind,entity_id) values('quotation_pdf',row.id);
  elsif p_action='revise' then
   if row.document->>'status'='draft' then raise exception 'MAS_VALIDATION: draft';end if;
   perform pg_advisory_xact_lock(hashtextextended(row.document->>'seriesId',0));
   select max((document->>'revision')::int)+1 into rev from mas.entities where resource='quotations' and document->>'seriesId'=row.document->>'seriesId';
   doc:=row.document-array['pdfPath','issuedAt','delivery','response','companySnapshot'];doc:=doc||jsonb_build_object('revision',rev,'status','draft');
   insert into mas.entities(resource,document,created_by) values('quotations',doc,staff.id) returning * into other;
   insert into mas.audit_logs(actor_id,resource,entity_id,action,after_version) values(staff.id,'quotations',other.id,'revision_created',1);
   result:=mas.envelope(other)||mas.job_meta(other);
  elsif p_action='sent' then
   if row.document->>'status'<>'issued' or p_data->>'channel' not in ('email','whatsapp','phone','in_person') then raise exception 'MAS_VALIDATION: delivery';end if;
   row.document:=row.document||jsonb_build_object('status','sent','delivery',jsonb_build_object('channel',p_data->>'channel','at',now(),'actorId',staff.id));
  elsif p_action in ('accepted','rejected') then
   if row.document->>'status'<>'sent' or length(trim(coalesce(p_data->>'reason','')))<3 or (p_action='accepted' and (row.document->>'validUntil')::date<(now() at time zone 'Africa/Cairo')::date) then raise exception 'MAS_VALIDATION: response';end if;
   row.document:=row.document||jsonb_build_object('status',p_action,'response',jsonb_build_object('reason',p_data->>'reason','at',now(),'actorId',staff.id));
  else
   if row.document->>'status' not in ('issued','sent') or (row.document->>'validUntil')::date>=(now() at time zone 'Africa/Cairo')::date then raise exception 'MAS_VALIDATION: expiry';end if;
   row.document:=row.document||jsonb_build_object('status','expired');
  end if;
 elsif p_resource='media' and p_action='complete_upload' then
  if row.document->>'status'<>'uploading' then raise exception 'MAS_VALIDATION: upload state';end if;
  row.document:=row.document||jsonb_build_object('status','quarantined');insert into mas.jobs(kind,entity_id) values('scan_media',row.id);
 else raise exception 'MAS_VALIDATION: action';end if;
 if p_action<>'create' then
  update mas.entities set document=row.document,published_document=row.published_document,deleted_at=row.deleted_at,version=version+1,updated_at=now() where id=row.id returning * into row;
 end if;
 if p_resource in ('products','categories','brands','sectors','attributes','content','contacts') and p_action in ('create','update','publish') then
  perform mas.sync_catalog(row.id);select * into row from mas.entities where id=row.id;
 end if;
 insert into mas.audit_logs(actor_id,resource,entity_id,action,before_version,after_version) values(staff.id,p_resource,row.id,p_action,old_row.version,row.version);
 if p_resource in ('quote_requests','inquiries','quotations') then insert into mas.events(entity_id,actor_id,kind,detail) values(row.id,staff.id,p_action,mas.pick(p_data,array['body','reason','status','channel','assignedTo']));end if;
 return coalesce(result,mas.envelope(row)||mas.job_meta(row));
end $$;

create or replace function public.mas_retry_job(p_resource text,p_id uuid,p_actor uuid,p_aal text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare staff mas.profiles;row mas.entities;job mas.jobs;job_kind text;
begin
 perform mas.require_service();
 staff:=mas.staff(p_actor,p_aal);
 if p_resource not in ('quotations','media') or not mas.allowed(staff,p_resource,true) then raise exception 'MAS_FORBIDDEN';end if;
 select * into row from mas.entities where id=p_id and resource=p_resource and deleted_at is null for update;
 if row.id is null or not mas.can_read(row,staff) then raise exception 'MAS_NOT_FOUND';end if;
 if p_resource='quotations' then
  if row.document->>'status'='draft' then raise exception 'MAS_VALIDATION: draft';end if;
  if row.document->>'pdfPath' is not null then return mas.envelope(row)||mas.job_meta(row);end if;
  job_kind:='quotation_pdf';
 else
  if row.document->>'status'<>'quarantined' then raise exception 'MAS_VALIDATION: quarantine state';end if;
  job_kind:='scan_media';
 end if;
 select * into job from mas.jobs where entity_id=row.id and kind=job_kind order by created_at desc limit 1 for update;
 if job.id is null or job.state='completed' then
  insert into mas.jobs(kind,entity_id) values(job_kind,row.id);
 elsif job.state='running' and job.lease_until>now() then
  null;
 else
  update mas.jobs set state='pending',attempts=0,available_at=now(),lease_token=null,lease_until=null,error_code=null where id=job.id;
 end if;
 insert into mas.audit_logs(actor_id,resource,entity_id,action) values(staff.id,p_resource,row.id,'retry_job');
 return mas.envelope(row)||mas.job_meta(row);
end $$;

create or replace function public.mas_health() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version','202611170001','ready',
 exists(select 1 from mas.profiles where active and roles && array['Admin','Owner']) and
 (public.mas_content('privacy')->>'policyVersion' is not null) and
 exists(select 1 from mas.entities where resource='settings' and deleted_at is null) and
 exists(select 1 from mas.entities where resource='units' and (document->>'active')::boolean and deleted_at is null));
$$;

create or replace function public.mas_bootstrap_owner(p_user_id uuid,p_display_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform mas.require_service();
 perform pg_advisory_xact_lock(hashtextextended('mas.owners',0));
 if exists(select 1 from mas.profiles where roles && array['Admin','Owner']) then raise exception 'MAS_CONFLICT: owner already initialized';end if;
 if not exists(select 1 from auth.users where id=p_user_id) or length(trim(p_display_name)) not between 2 and 120 then raise exception 'MAS_VALIDATION';end if;
 insert into mas.profiles(id,display_name,roles) values(p_user_id,p_display_name,array['Owner']);
 insert into mas.audit_logs(actor_id,resource,entity_id,action) values(p_user_id,'profiles',p_user_id,'bootstrap_owner');
 return jsonb_build_object('id',p_user_id,'active',true,'roles',jsonb_build_array('Owner'));
end $$;

revoke all on all functions in schema mas from public,anon,authenticated;
revoke all on function public.mas_retry_job(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.mas_retry_job(text,uuid,uuid,text) to service_role;

-- Enforce the single Admin role on direct RPC reads as well as API writes.
-- Legacy role values are retained in storage without granting them Admin access.
create or replace function mas.staff(p_actor uuid,p_aal text default null) returns mas.profiles
language plpgsql stable security definer set search_path='' as $$
declare staff mas.profiles;
begin
 select * into staff from mas.profiles where id=p_actor and active and roles && array['Admin','Owner'];
 if staff.id is null then raise exception 'MAS_FORBIDDEN';end if;
 if coalesce(p_aal,auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'MAS_MFA_REQUIRED';end if;
 return staff;
end $$;
create or replace function mas.allowed(p_staff mas.profiles,p_resource text,p_write boolean default false) returns boolean
language sql immutable set search_path='' as $$
 select p_staff.active and p_staff.roles && array['Admin','Owner'];
$$;
-- Authentication metadata remains readable at aal1 for MFA enrollment.
create or replace function public.mas_actor() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare staff mas.profiles;
begin
 select * into staff from mas.profiles where id=auth.uid() and active and roles && array['Admin','Owner'];
 if staff.id is null then raise exception 'MAS_FORBIDDEN';end if;
 return jsonb_build_object('id',staff.id,'active',staff.active,'roles',staff.roles,'displayName',staff.display_name);
end $$;
