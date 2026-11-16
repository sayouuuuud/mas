-- ============================================================================
-- M.A.S B2B Product Catalog & RFQ Platform — Complete Database Schema
-- Source: supabase/migrations (commit 37c8861feb90b83ef1f1056c9676c1b0cca47161)
-- Compatible with Supabase SQL Editor (PostgreSQL 17, Auth & Storage enabled)
-- Order:
--   1. 202611160001_core.sql
--   2. 202611160002_commands.sql
--   3. 202611160003_jobs_storage_reports.sql
--   4. 202611160004_batches.sql
--   5. 202611160005_bootstrap.sql
-- ============================================================================

begin;

-- ============================================================================
-- 1. 202611160001_core.sql
-- ============================================================================

-- Application data lives outside PostgREST's exposed public schema.
-- All writes are server-only RPCs; public RPCs project published fields explicitly.
create schema if not exists mas;
revoke all on schema mas from public;

create table mas.profiles (
 id uuid primary key references auth.users(id) on delete restrict,
 display_name text not null check(length(display_name) between 2 and 120),
 roles text[] not null check(cardinality(roles)>0 and roles <@ array['Owner','Catalog Manager','Content Editor','Sales Manager','Sales Agent']),
 active boolean not null default true,
 version bigint not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Content has different shapes per resource; validation is in versioned Zod contracts.
-- The common envelope provides atomic versions, soft deletion and audit identity.
create table mas.entities (
 id uuid primary key default gen_random_uuid(),
 resource text not null check(resource in ('products','categories','brands','sectors','units','attributes','contacts','organizations','content','navigation','locations','settings','quote_requests','inquiries','quotations','media')),
 document jsonb not null check(jsonb_typeof(document)='object'),
 published_document jsonb,
 version bigint not null default 1 check(version>0),
 created_by uuid references mas.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 unique(id,resource)
);
create unique index settings_singleton on mas.entities(resource) where resource='settings' and deleted_at is null;
create unique index entities_slug on mas.entities(resource,lower(document->>'slug')) where deleted_at is null and document ? 'slug';
create unique index entities_code on mas.entities(resource,lower(document->>'code')) where deleted_at is null and document ? 'code';
create unique index content_key on mas.entities((document->>'key')) where resource='content' and deleted_at is null;
create unique index request_reference on mas.entities((document->>'reference')) where resource in ('quote_requests','inquiries');
create unique index quotation_number_revision on mas.entities((document->>'number'),((document->>'revision')::integer)) where resource='quotations';
create unique index quotation_single_draft on mas.entities((document->>'seriesId')) where resource='quotations' and document->>'status'='draft' and deleted_at is null;
create index entities_resource_status on mas.entities(resource,(document->>'status'),created_at desc) where deleted_at is null;
create index entities_assignee on mas.entities((document->>'assignedTo'),resource) where deleted_at is null;
create index entities_search on mas.entities using gin(to_tsvector('simple',document::text));
create index entities_document on mas.entities using gin(document jsonb_path_ops);

create table mas.entity_links (
 source_id uuid not null references mas.entities(id),
 target_id uuid not null references mas.entities(id),
 kind text not null,
 primary key(source_id,target_id,kind), check(source_id<>target_id)
);
create index entity_links_target on mas.entity_links(target_id);

create table mas.variants (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references mas.entities(id),
 unit_id uuid not null references mas.entities(id),
 sku text not null check(length(trim(sku)) between 1 and 120),
 document jsonb not null,
 active boolean not null default true,
 retired_at timestamptz
);
create unique index variant_sku on mas.variants(lower(sku));
create index variants_product on mas.variants(product_id);

create table mas.sales_items (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references mas.entities(id),
 variant_id uuid references mas.variants(id), unit_id uuid not null references mas.entities(id),
 quantity numeric(12,3) not null check(quantity>=.001 and quantity<=99999),
 snapshot jsonb not null, notes text check(length(notes)<=500),
 position integer not null check(position>=0),unique(request_id,position)
);
create table mas.events (
 id uuid primary key default gen_random_uuid(), entity_id uuid not null references mas.entities(id),
 actor_id uuid references mas.profiles(id), kind text not null,
 detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create index events_entity on mas.events(entity_id,created_at);
create table mas.audit_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references mas.profiles(id),
 resource text not null, entity_id uuid, action text not null,
 before_version bigint, after_version bigint, detail jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create table mas.policy_versions (
version text primary key, content jsonb not null, published_at timestamptz not null default now()
);
create table mas.consents (
 id uuid primary key default gen_random_uuid(), entity_id uuid not null references mas.entities(id),
 policy_version text not null references mas.policy_versions(version), accepted_at timestamptz not null default now(),
 source_page text not null, locale text not null check(locale in ('ar','en'))
);
create table mas.idempotency_keys (
 key_hash text primary key, payload_hash text not null, entity_id uuid not null references mas.entities(id),
 reference text not null, received_at timestamptz not null, expires_at timestamptz not null default now()+interval '7 days'
);
create table mas.rate_limits (
 key text primary key, counter integer not null, resets_at timestamptz not null
);
create table mas.invitations (
 id uuid primary key default gen_random_uuid(), email text not null,
 display_name text not null, roles text[] not null, invited_by uuid not null references mas.profiles(id),
 status text not null default 'pending' check(status in ('pending','confirmed')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '1 day'
);
create unique index invitations_pending_email on mas.invitations(lower(email)) where status='pending';
create table mas.jobs (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('scan_media','quotation_pdf','delete_media')),
 entity_id uuid references mas.entities(id),payload jsonb not null default '{}',
 state text not null default 'pending' check(state in ('pending','running','completed','failed')),
 attempts integer not null default 0,max_attempts integer not null default 5,
 available_at timestamptz not null default now(),lease_token uuid,lease_until timestamptz,
 error_code text,created_at timestamptz not null default now(),completed_at timestamptz
);
create index jobs_pending on mas.jobs(available_at) where state in ('pending','running');
create sequence mas.rfq_sequence;
create sequence mas.inquiry_sequence;
create sequence mas.quotation_sequence;

-- Every table has RLS even though table privileges and schema visibility are revoked.
do $$ declare item record; begin
 for item in select tablename from pg_tables where schemaname='mas' loop
  execute format('alter table mas.%I enable row level security',item.tablename);
  execute format('revoke all on mas.%I from public, anon, authenticated',item.tablename);
 end loop;
end $$;

create function mas.staff(p_actor uuid,p_aal text default null) returns mas.profiles
language plpgsql stable security definer set search_path='' as $$
declare staff mas.profiles; level text;
begin
 select * into staff from mas.profiles where id=p_actor and active;
 if staff.id is null then raise exception 'MAS_FORBIDDEN';end if;
 level:=coalesce(p_aal,auth.jwt()->>'aal','aal1');
 if staff.roles && array['Owner','Sales Manager'] and level<>'aal2' then raise exception 'MAS_MFA_REQUIRED';end if;
 return staff;
end $$;

create function mas.allowed(p_staff mas.profiles,p_resource text,p_write boolean default false) returns boolean
language sql immutable set search_path='' as $$
 select 'Owner'=any(p_staff.roles) or case
 when p_resource in ('products','categories','brands','sectors','units','attributes') then
   p_staff.roles && (case when p_write then array['Catalog Manager'] else array['Catalog Manager','Sales Manager','Sales Agent','Content Editor'] end)
 when p_resource='media' then p_staff.roles && array['Catalog Manager','Content Editor']
 when p_resource in ('content','navigation','locations') then 'Content Editor'=any(p_staff.roles)
 when p_resource in ('contacts','organizations','quote_requests','inquiries','quotations','request_events','quotation_events','reports') then p_staff.roles && array['Sales Manager','Sales Agent']
 else false end;
$$;

create function mas.can_read(p_entity mas.entities,p_staff mas.profiles) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare request_row mas.entities;
begin
 if p_staff.id is null or not mas.allowed(p_staff,p_entity.resource) then return false;end if;
 if 'Owner'=any(p_staff.roles) or 'Sales Manager'=any(p_staff.roles) or p_entity.resource not in ('quote_requests','inquiries','quotations','contacts','organizations') then return true;end if;
 if p_entity.resource in ('quote_requests','inquiries') then return p_entity.document->>'assignedTo'=p_staff.id::text;end if;
 if p_entity.resource='quotations' then select * into request_row from mas.entities where id=(p_entity.document->>'requestId')::uuid;return request_row.document->>'assignedTo'=p_staff.id::text;end if;
 if p_entity.resource='contacts' then return p_entity.created_by=p_staff.id or exists(select 1 from mas.entities e where e.resource in ('quote_requests','inquiries') and e.deleted_at is null and e.document->>'assignedTo'=p_staff.id::text and e.document->>'contactId'=p_entity.id::text);end if;
 return exists(select 1 from mas.entities e where e.resource='contacts' and e.document->>'organizationId'=p_entity.id::text and mas.can_read(e,p_staff));
end $$;

create function mas.envelope(p_entity mas.entities) returns jsonb
language sql immutable set search_path='' as $$
 select p_entity.document || jsonb_build_object('id',p_entity.id,'version',p_entity.version,'createdAt',p_entity.created_at,'updatedAt',p_entity.updated_at);
$$;
create function mas.pick(p_data jsonb,p_keys text[]) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(p_data) where key=any(p_keys);
$$;

create function mas.public_media(p_ids jsonb) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(mas.pick(mas.envelope(e),array['id','name','mime','alt','kind','path','size'])),'[]'::jsonb)
 from mas.entities e where e.resource='media' and e.deleted_at is null and e.document->>'status'='ready' and e.document->>'visibility'='public'
 and e.id::text in(select jsonb_array_elements_text(coalesce(p_ids,'[]')));
$$;
create function mas.public_entity(p_entity mas.entities) returns jsonb
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
 end if;
 return null;
end $$;

create function public.mas_actor() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare staff mas.profiles;
begin
 select * into staff from mas.profiles where id=auth.uid() and active;
 if staff.id is null then raise exception 'MAS_FORBIDDEN';end if;
 return jsonb_build_object('id',staff.id,'active',staff.active,'roles',staff.roles);
end $$;

create function public.mas_get(p_resource text,p_id text,p_private boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare row mas.entities;staff mas.profiles;result jsonb;
begin
 if p_private then staff:=mas.staff(auth.uid());end if;
 if p_resource='profiles' and p_private then
  if not (staff.roles && array['Owner','Sales Manager']) then raise exception 'MAS_FORBIDDEN';end if;
  select jsonb_build_object('id',id,'displayName',display_name,'roles',roles,'active',active,'version',version) into result from mas.profiles where id::text=p_id;return result;
 end if;
 select * into row from mas.entities where resource=p_resource and deleted_at is null and (id::text=p_id or document->>'slug'=p_id);
 if row.id is null then return null;end if;
 if p_private then
  if not mas.can_read(row,staff) then return null;end if;
  result:=mas.envelope(row);
  if p_resource in ('quote_requests','inquiries') then
   result:=result||jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'variantId',i.variant_id,'unitId',i.unit_id,'quantity',i.quantity,'snapshot',i.snapshot,'notes',i.notes) order by position) from mas.sales_items i where request_id=row.id),'[]'),'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',kind,'detail',detail,'actorId',actor_id,'createdAt',created_at) order by created_at) from mas.events e where entity_id=row.id),'[]'));
  end if;
  return result;
 end if;
 return mas.public_entity(row);
end $$;

create function mas.matches(p_entity mas.entities,p_filters jsonb,p_public boolean default false) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare doc jsonb:=p_entity.document;q text:=lower(coalesce(p_filters->>'q',''));value text;
begin
 if p_entity.deleted_at is not null then return false;end if;
 if p_filters->>'status' is not null and doc->>'status' is distinct from p_filters->>'status' then return false;end if;
 if p_filters->>'assignedTo' is not null then
  if p_entity.resource in ('quote_requests','inquiries') and doc->>'assignedTo' is distinct from p_filters->>'assignedTo' then return false;end if;
  if p_entity.resource='quotations' and not exists(select 1 from mas.entities r where r.id::text=doc->>'requestId' and r.document->>'assignedTo'=p_filters->>'assignedTo') then return false;end if;
 end if;
 if p_filters->>'from' is not null and p_entity.created_at::date<(p_filters->>'from')::date then return false;end if;
 if p_filters->>'to' is not null and p_entity.created_at::date>(p_filters->>'to')::date then return false;end if;
 if q<>'' and position(q in lower(coalesce((case when p_public then mas.public_entity(p_entity) else doc end)::text,'')||p_entity.id::text))=0 then return false;end if;
 if jsonb_array_length(coalesce(p_filters->'category','[]'))>0 and not exists(
  with recursive cats(id) as (
   select e.id from mas.entities e where e.resource='categories' and e.id::text in(select jsonb_array_elements_text(p_filters->'category'))
   union select e.id from mas.entities e join cats c on e.document->>'parentId'=c.id::text where e.resource='categories' and e.deleted_at is null
  ) select 1 from cats where id::text=doc->>'categoryId'
 ) then return false;end if;
 if jsonb_array_length(coalesce(p_filters->'brand','[]'))>0 and not coalesce(p_filters->'brand','[]') ? (doc->>'brandId') then return false;end if;
 if jsonb_array_length(coalesce(p_filters->'sector','[]'))>0 and not coalesce(doc->'sectorIds','[]') ?| array(select jsonb_array_elements_text(p_filters->'sector')) then return false;end if;
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

create function public.mas_list(p_resource text,p_filters jsonb default '{}',p_private boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare staff mas.profiles;count_rows bigint;rows jsonb;page integer:=greatest(1,coalesce((p_filters->>'page')::int,1));size integer:=least(1000,greatest(1,coalesce((p_filters->>'pageSize')::int,24)));
begin
 if p_private then staff:=mas.staff(auth.uid());end if;
 if p_private and p_resource='profiles' then
  if not ('Owner'=any(staff.roles)) then raise exception 'MAS_FORBIDDEN';end if;
  return (select jsonb_build_object('data',coalesce(jsonb_agg(jsonb_build_object('id',p.id,'version',p.version,'displayName',p.display_name,'active',p.active,'roles',p.roles)),'[]'),'total',(select count(*) from mas.profiles)) from (select * from mas.profiles order by created_at limit size offset (page-1)*size) p);
 elsif p_private and p_resource='audit_logs' then
  if not ('Owner'=any(staff.roles)) then raise exception 'MAS_FORBIDDEN';end if;
  return (select jsonb_build_object('data',coalesce(jsonb_agg(to_jsonb(a)),'[]'),'total',(select count(*) from mas.audit_logs)) from (select * from mas.audit_logs order by created_at desc limit size offset (page-1)*size) a);
 end if;
 if p_private and not mas.allowed(staff,p_resource) then raise exception 'MAS_FORBIDDEN';end if;
 with eligible as materialized (
 select e,case when p_private then mas.envelope(e) else mas.public_entity(e) end as projected
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

create function public.mas_content(p_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_key in ('navigation','locations','settings','units') then
  select jsonb_build_object('items',coalesce(jsonb_agg(mas.public_entity(e) order by coalesce((e.document->>'order')::int,0)) filter(where mas.public_entity(e) is not null),'[]')) into result from mas.entities e where resource=p_key and deleted_at is null;return result;
 end if;
 select mas.public_entity(e) into result from mas.entities e where resource='content' and document->>'key'=p_key and deleted_at is null;return result;
end $$;

create function public.mas_unit(p_code text) returns jsonb
language sql stable security definer set search_path='' as $$
 select mas.public_entity(e) from mas.entities e where resource='units' and document->>'code'=p_code and deleted_at is null;
$$;
create function public.mas_resolve_variant(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('product',mas.pick(mas.envelope(p),array['id','name','slug']),'variant',v.document||jsonb_build_object('id',v.id,'active',v.active),'unit',mas.public_entity(u))
 from mas.variants v join mas.entities p on p.id=v.product_id join mas.entities u on u.id=v.unit_id
 where v.id=p_id and v.active and v.retired_at is null and p.document->>'status'='published' and p.deleted_at is null and u.deleted_at is null and (u.document->>'active')::boolean;
$$;
create function public.mas_facets(p_filters jsonb default '{}') returns jsonb
language sql stable security definer set search_path='' as $$
 with products as materialized (select e from mas.entities e where resource='products' and document->>'status'='published' and mas.matches(e,p_filters,true)),
 refs as (select r.id,r.resource,mas.public_entity(r) as value,count(p.e) as count from mas.entities r left join products p on
  (r.resource='categories' and (p.e).document->>'categoryId'=r.id::text) or (r.resource='brands' and (p.e).document->>'brandId'=r.id::text) or (r.resource='sectors' and (p.e).document->'sectorIds' ? r.id::text)
  where r.resource in ('categories','brands','sectors') and r.deleted_at is null and r.document->>'status'='published' group by r.id),
 variants as materialized (select v.* from mas.variants v join products p on (p.e).id=v.product_id where v.active and v.retired_at is null),
 availability as (select document->>'availability' value,count(distinct product_id) count from variants group by 1),
 packs as (select document->>'packQuantity' value,count(distinct product_id) count from variants where document->>'packQuantity' is not null group by 1),
 specs as (select (p.e).id product_id,s from products p cross join lateral jsonb_array_elements(coalesce((p.e).document->'specifications','[]')) s union all select v.product_id,s from variants v cross join lateral jsonb_array_elements(coalesce(v.document->'specifications','[]')) s),
 spec_values as (select product_id,s->>'attributeId' attribute_id,element value from specs cross join lateral jsonb_array_elements(case when jsonb_typeof(s->'value')='array' then s->'value' else jsonb_build_array(s->'value') end) element),
 spec_counts as (select attribute_id,value,count(distinct product_id) count from spec_values group by attribute_id,value),
 attributes as (select mas.pick(mas.envelope(a),array['id','name','code','type','scope','unitId','options'])||jsonb_build_object('values',jsonb_agg(jsonb_build_object('value',v.value,'count',v.count))) value from mas.entities a join spec_counts v on v.attribute_id=a.id::text where a.resource='attributes' and a.deleted_at is null and (a.document->>'filterable')::boolean group by a.id)
 select jsonb_build_object('total',(select count(*) from products),
 'categories',coalesce(jsonb_agg(value||jsonb_build_object('count',count)) filter(where resource='categories'),'[]'),
 'brands',coalesce(jsonb_agg(value||jsonb_build_object('count',count)) filter(where resource='brands'),'[]'),
 'sectors',coalesce(jsonb_agg(value||jsonb_build_object('count',count)) filter(where resource='sectors'),'[]'),
 'availability',coalesce((select jsonb_agg(jsonb_build_object('value',value,'count',count)) from availability),'[]'),
 'packs',coalesce((select jsonb_agg(jsonb_build_object('value',value,'count',count)) from packs),'[]'),
 'attributes',coalesce((select jsonb_agg(value) from attributes),'[]')) from refs;
$$;

-- No internal helpers may be called directly from client SDKs.
revoke all on all functions in schema mas from public, anon, authenticated;
revoke all on function public.mas_actor() from public,anon;
grant execute on function public.mas_actor() to authenticated;
revoke all on function public.mas_get(text,text,boolean),public.mas_list(text,jsonb,boolean),public.mas_content(text),public.mas_unit(text),public.mas_resolve_variant(uuid),public.mas_facets(jsonb) from public;
grant execute on function public.mas_get(text,text,boolean),public.mas_list(text,jsonb,boolean),public.mas_content(text),public.mas_unit(text),public.mas_resolve_variant(uuid),public.mas_facets(jsonb) to anon,authenticated;

-- ============================================================================
-- 2. 202611160002_commands.sql
-- ============================================================================

create function mas.require_service() returns void
language plpgsql stable security definer set search_path='' as $$
begin if coalesce(auth.role(),'')<>'service_role' then raise exception 'MAS_FORBIDDEN';end if;end $$;

create function mas.reference(p_id uuid,p_resource text,p_published boolean default false) returns mas.entities
language plpgsql stable security definer set search_path='' as $$
declare row mas.entities;
begin
 select * into row from mas.entities where id=p_id and resource=p_resource and deleted_at is null;
 if row.id is null or (p_published and row.document->>'status'<>'published') then raise exception 'MAS_VALIDATION: reference';end if;
 return row;
end $$;

create function mas.link(p_source uuid,p_target text,p_kind text,p_resource text,p_published boolean default false) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_target is null then return;end if;
 perform mas.reference(p_target::uuid,p_resource,p_published);
 insert into mas.entity_links(source_id,target_id,kind) values(p_source,p_target::uuid,p_kind) on conflict do nothing;
end $$;

create function mas.sync_catalog(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare row mas.entities;item jsonb;v mas.variants;vid uuid;key text;ids uuid[]:='{}';published boolean;unit mas.entities;media mas.entities;parent uuid;seen uuid[];updated_variants jsonb:='[]';
begin
 select * into row from mas.entities where id=p_id;
 published:=row.document->>'status'='published';
 delete from mas.entity_links where source_id=p_id;
 if row.resource='products' then
  unit:=mas.reference((row.document->>'categoryId')::uuid,'categories',published);
  if unit.document->>'family' is not null and unit.document->>'family'<>row.document->>'family' then raise exception 'MAS_VALIDATION: product family';end if;
  perform mas.link(p_id,row.document->>'categoryId','category','categories',published);
  for item in select value from jsonb_array_elements(coalesce(row.document->'specifications','[]')) loop perform mas.link(p_id,item->>'attributeId','specification','attributes');end loop;
  perform mas.link(p_id,row.document->>'brandId','brand','brands',published);
  for item in select value from jsonb_array_elements(coalesce(row.document->'sectorIds','[]')) loop perform mas.link(p_id,item#>>'{}','sector','sectors',published);end loop;
  for item in select value from jsonb_array_elements(coalesce(row.document->'relatedIds','[]')) loop perform mas.link(p_id,item#>>'{}','related','products',false);end loop;
  perform mas.link(p_id,row.document->>'mainMediaId','main_media','media');
  for item in select value from jsonb_array_elements(coalesce(row.document->'mediaIds','[]')) loop perform mas.link(p_id,item#>>'{}','media','media');end loop;
  if published then
   if coalesce(row.document->'name'->>'ar','')='' or coalesce(row.document->'name'->>'en','')='' or coalesce(row.document->'summary'->>'ar','')='' or coalesce(row.document->'summary'->>'en','')='' or coalesce(row.document->'description'->>'ar','')='' or coalesce(row.document->'description'->>'en','')='' then raise exception 'MAS_VALIDATION: bilingual';end if;
   media:=mas.reference((row.document->>'mainMediaId')::uuid,'media');
   if media.document->>'status'<>'ready' or media.document->>'visibility'<>'public' or media.document->>'kind'<>'image' or coalesce(media.document->'alt'->>'ar','')='' or coalesce(media.document->'alt'->>'en','')='' then raise exception 'MAS_VALIDATION: image';end if;
  end if;
  for item in select value from jsonb_array_elements(row.document->'variants') loop
   vid:=coalesce((item->>'id')::uuid,gen_random_uuid());
   select * into v from mas.variants where id=vid;
   if v.id is not null and v.product_id<>p_id then raise exception 'MAS_VALIDATION: variant owner';end if;
   unit:=mas.reference((item->>'unitId')::uuid,'units');
   if not (unit.document->>'active')::boolean then raise exception 'MAS_VALIDATION: inactive unit';end if;
   if (item->>'minQuantity')::numeric<=0 or (item->>'quantityStep')::numeric<=0 or mod((item->>'minQuantity')::numeric*power(10::numeric,(unit.document->>'precision')::int),1)<>0 or mod((item->>'quantityStep')::numeric*power(10::numeric,(unit.document->>'precision')::int),1)<>0 then raise exception 'MAS_VALIDATION: unit quantity';end if;
   item:=item||jsonb_build_object('id',vid);
   insert into mas.variants(id,product_id,unit_id,sku,document,active) values(vid,p_id,(item->>'unitId')::uuid,item->>'sku',item,coalesce((item->>'active')::boolean,true))
   on conflict(id) do update set unit_id=excluded.unit_id,sku=excluded.sku,document=excluded.document,active=excluded.active,retired_at=null;
   ids:=array_append(ids,vid);updated_variants:=updated_variants||jsonb_build_array(item);
   for key in select value->>'attributeId' from jsonb_array_elements(coalesce(item->'specifications','[]')) loop perform mas.link(p_id,key,'specification','attributes');end loop;
   perform mas.link(p_id,item->>'unitId','variant_unit','units');perform mas.link(p_id,item->>'packUnitId','pack_unit','units');
   for key in select jsonb_array_elements_text(coalesce(item->'mediaIds','[]')) loop perform mas.link(p_id,key,'variant_media','media');end loop;
  end loop;
  update mas.variants set active=false,retired_at=now() where product_id=p_id and not(id=any(ids));
  update mas.entities set document=jsonb_set(document,'{variants}',updated_variants) where id=p_id;
  if published and not exists(select 1 from mas.variants where product_id=p_id and active and retired_at is null) then raise exception 'MAS_VALIDATION: active variant';end if;
 elsif row.resource='categories' then
  parent:=(row.document->>'parentId')::uuid;seen:=array[p_id];
  while parent is not null loop
   if parent=any(seen) then raise exception 'MAS_VALIDATION: category cycle';end if;
   seen:=array_append(seen,parent);unit:=mas.reference(parent,'categories',published);parent:=(unit.document->>'parentId')::uuid;
  end loop;
  perform mas.link(p_id,row.document->>'parentId','parent','categories',published);
 elsif row.resource='attributes' then
  perform mas.link(p_id,row.document->>'unitId','attribute_unit','units');
  for item in select value from jsonb_array_elements(coalesce(row.document->'categories','[]')) loop perform mas.link(p_id,item->>'categoryId','attribute_category','categories');end loop;
 elsif row.resource='contacts' then perform mas.link(p_id,row.document->>'organizationId','organization','organizations');
 end if;
 if row.resource in ('categories','brands','sectors') then
  perform mas.link(p_id,row.document->>'imageMediaId','image','media');perform mas.link(p_id,row.document->>'logoMediaId','logo','media');
 elsif row.resource='content' then
  for key in select jsonb_array_elements_text(coalesce(row.document->'mediaIds','[]')||coalesce(row.published_document->'mediaIds','[]')) loop perform mas.link(p_id,key,'content_media','media');end loop;
 end if;
end $$;

create function mas.store_items(p_request uuid,p_items jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare item jsonb;resolution jsonb;unit mas.entities;quantity numeric;position integer:=0;chosen_variant uuid;unit_id uuid;snapshot jsonb;
begin
 if jsonb_array_length(p_items) not between 1 and 30 then raise exception 'MAS_VALIDATION: items';end if;
 for item in select value from jsonb_array_elements(p_items) loop
  quantity:=(item->>'quantity')::numeric;chosen_variant:=(item->>'variantId')::uuid;
  if chosen_variant is not null then
   -- Lock the same catalog mutex as publication so validation and snapshots are atomic.
   resolution:=public.mas_resolve_variant(chosen_variant);
   if resolution is null or resolution->'variant'->>'availability'='unavailable' then raise exception 'MAS_VALIDATION: unavailable variant';end if;
   unit_id:=(resolution->'unit'->>'id')::uuid;
   if item->>'unitCode'<>resolution->'unit'->>'code' or quantity<(resolution->'variant'->>'minQuantity')::numeric or mod(quantity-(resolution->'variant'->>'minQuantity')::numeric,(resolution->'variant'->>'quantityStep')::numeric)<>0 then raise exception 'MAS_VALIDATION: variant quantity';end if;
   if exists(select 1 from mas.sales_items where request_id=p_request and mas.sales_items.variant_id=chosen_variant) then raise exception 'MAS_VALIDATION: duplicate item';end if;
   snapshot:=jsonb_build_object('name',resolution->'product'->'name','sku',resolution->'variant'->'sku','label',resolution->'variant'->'label','unit',resolution->'unit'->'name');
  else
   select id into unit_id from mas.entities where resource='units' and document->>'code'=item->>'unitCode' and (document->>'active')::boolean and deleted_at is null;
   if unit_id is null or length(trim(item->>'description'))<3 then raise exception 'MAS_VALIDATION: free item';end if;
   snapshot:=jsonb_build_object('description',item->>'description');
   if item->>'categoryId' is not null then unit:=mas.reference((item->>'categoryId')::uuid,'categories',true);snapshot:=snapshot||jsonb_build_object('categoryId',unit.id,'categoryName',unit.document->'name');end if;
   if item->>'brandId' is not null then unit:=mas.reference((item->>'brandId')::uuid,'brands',true);snapshot:=snapshot||jsonb_build_object('brandId',unit.id,'brandName',unit.document->'name');end if;
  end if;
  unit:=mas.reference(unit_id,'units');
  if mod(quantity*power(10::numeric,(unit.document->>'precision')::int),1)<>0 then raise exception 'MAS_VALIDATION: quantity precision';end if;
  snapshot:=snapshot||jsonb_build_object('unitCode',unit.document->>'code','unit',unit.document->'name');
  insert into mas.sales_items(request_id,variant_id,unit_id,quantity,snapshot,notes,position) values(p_request,chosen_variant,unit_id,quantity,snapshot,item->>'notes',position);
  position:=position+1;
 end loop;
end $$;

create function public.mas_submit(p_kind text,p_payload jsonb,p_key text,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare submission_key text;prior mas.idempotency_keys;row mas.entities;ref text;resource_name text;policy jsonb;
begin
 perform mas.require_service();
 if p_kind not in ('request','inquiry') or length(p_key) not between 16 and 128 then raise exception 'MAS_VALIDATION';end if;
 submission_key:=encode(sha256(convert_to(p_kind||':'||p_key,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(submission_key,0));
 select * into prior from mas.idempotency_keys where mas.idempotency_keys.key_hash=submission_key;
 if prior.key_hash is not null then
  if prior.payload_hash<>p_hash then raise exception 'MAS_CONFLICT';end if;
  return jsonb_build_object('reference',prior.reference,'receivedAt',prior.received_at,'replayed',true);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('mas.catalog',0));
 policy:=public.mas_content('privacy');
 if policy is null or policy->>'policyVersion' is distinct from p_payload->'privacy'->>'policyVersion' or p_payload->'privacy'->>'accepted'<>'true' then raise exception 'MAS_VALIDATION: consent';end if;
 resource_name:=case when p_kind='request' then 'quote_requests' else 'inquiries' end;
 ref:=case when p_kind='request' then 'RFQ-' else 'INQ-' end||to_char(now() at time zone 'Africa/Cairo','YYYY')||'-'||lpad(nextval(case when p_kind='request' then 'mas.rfq_sequence' else 'mas.inquiry_sequence' end::regclass)::text,7,'0');
 insert into mas.entities(resource,document) values(resource_name,jsonb_build_object('reference',ref,'locale',p_payload->'locale','customerSnapshot',p_payload->'customer','status','new','assignedTo',null,'priority','normal','notes',p_payload->'notes','message',p_payload->'message','source',p_payload->'source','receivedAt',now())) returning * into row;
 if p_kind='request' then perform mas.store_items(row.id,p_payload->'items');end if;
 insert into mas.consents(entity_id,policy_version,source_page,locale) values(row.id,p_payload->'privacy'->>'policyVersion',p_payload->'source'->>'page',p_payload->>'locale');
 insert into mas.events(entity_id,kind) values(row.id,'received');
 insert into mas.idempotency_keys(key_hash,payload_hash,entity_id,reference,received_at) values(submission_key,p_hash,row.id,ref,row.created_at);
 return jsonb_build_object('reference',ref,'receivedAt',row.created_at,'replayed',false);
end $$;

create function public.mas_rate_limit(p_key text,p_maximum integer,p_window integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row mas.rate_limits;
begin
 perform mas.require_service();
 if length(p_key)<>64 or p_maximum not between 1 and 1000 or p_window not between 1 and 86400 then raise exception 'MAS_VALIDATION';end if;
 insert into mas.rate_limits(key,counter,resets_at) values(p_key,1,now()+make_interval(secs=>p_window))
 on conflict(key) do update set counter=case when mas.rate_limits.resets_at<=now() then 1 else mas.rate_limits.counter+1 end,resets_at=case when mas.rate_limits.resets_at<=now() then now()+make_interval(secs=>p_window) else mas.rate_limits.resets_at end returning * into row;
 return jsonb_build_object('allowed',row.counter<=p_maximum,'retryAfter',greatest(1,ceil(extract(epoch from row.resets_at-now()))));
end $$;

create function public.mas_command(p_resource text,p_action text,p_id uuid,p_version bigint,p_data jsonb,p_actor uuid,p_aal text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare staff mas.profiles;row mas.entities;old_row mas.entities;other mas.entities;target mas.profiles;invitation mas.invitations;result jsonb;doc jsonb;new_id uuid;new_status text;allowed text[];number_value text;series text;rev int;field text;item jsonb;
begin
 perform mas.require_service();staff:=mas.staff(p_actor,p_aal);
 if p_resource in ('products','categories','brands','sectors','units','attributes','media','content') then perform pg_advisory_xact_lock(hashtextextended('mas.catalog',0));end if;
 if p_resource='audit_logs' and p_action='export' then
  if not mas.allowed(staff,p_data->>'resource') or (p_data->>'resource'<>'products' and not (staff.roles && array['Owner','Sales Manager'])) then raise exception 'MAS_FORBIDDEN';end if;
  insert into mas.audit_logs(actor_id,resource,action,detail) values(staff.id,p_data->>'resource','export',jsonb_build_object('count',p_data->'count')) returning jsonb_build_object('id',id,'version',1) into result;return result;
 end if;
 if p_resource='profiles' then
  if not ('Owner'=any(staff.roles)) then raise exception 'MAS_FORBIDDEN';end if;
  -- Serialize owners so concurrent changes cannot remove the last active owner.
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
   if target.id=staff.id and (not (p_data->>'active')::boolean or not (p_data->'roles' ? 'Owner')) then raise exception 'MAS_VALIDATION: self protection';end if;
   if target.active and 'Owner'=any(target.roles) and (not (p_data->>'active')::boolean or not p_data->'roles' ? 'Owner') and not exists(select 1 from mas.profiles where id<>target.id and active and 'Owner'=any(roles)) then raise exception 'MAS_VALIDATION: last owner';end if;
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
  if exists(select 1 from mas.entity_links l join mas.entities e on e.id=l.source_id where l.target_id=row.id and e.deleted_at is null) or exists(select 1 from mas.sales_items where unit_id=row.id) then raise exception 'MAS_VALIDATION: dependencies';end if;
  if p_resource='media' and row.document->>'status'='ready' then insert into mas.jobs(kind,entity_id,payload) values('delete_media',row.id,jsonb_build_object('path',row.document->>'path','bucket',case when row.document->>'visibility'='public' then 'catalog-public' else 'catalog-private' end));end if;
  row.deleted_at:=now();
  if p_resource='products' then update mas.variants set active=false,retired_at=now() where product_id=row.id;end if;
 elsif p_action='assign' and p_resource in ('quote_requests','inquiries') then
  if not (staff.roles && array['Owner','Sales Manager']) then raise exception 'MAS_FORBIDDEN';end if;
  if p_data->>'assignedTo' is not null then
   select * into target from mas.profiles where id=(p_data->>'assignedTo')::uuid and active and roles && array['Owner','Sales Manager','Sales Agent'];
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
  if row.document->>'status' in ('won','lost','cancelled','resolved','spam') and not (staff.roles && array['Owner','Sales Manager']) then raise exception 'MAS_FORBIDDEN';end if;
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
   insert into mas.jobs(kind,entity_id) values('quotation_pdf',row.id);
  elsif p_action='revise' then
   if row.document->>'status'='draft' then raise exception 'MAS_VALIDATION: draft';end if;
   perform pg_advisory_xact_lock(hashtextextended(row.document->>'seriesId',0));
   select max((document->>'revision')::int)+1 into rev from mas.entities where resource='quotations' and document->>'seriesId'=row.document->>'seriesId';
   doc:=row.document-array['pdfPath','issuedAt','delivery','response','companySnapshot'];doc:=doc||jsonb_build_object('revision',rev,'status','draft');
   insert into mas.entities(resource,document,created_by) values('quotations',doc,staff.id) returning * into other;
   insert into mas.audit_logs(actor_id,resource,entity_id,action,after_version) values(staff.id,'quotations',other.id,'revision_created',1);
   result:=mas.envelope(other);
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
 return coalesce(result,mas.envelope(row));
end $$;

revoke all on all functions in schema mas from public,anon,authenticated;
revoke all on function public.mas_command(text,text,uuid,bigint,jsonb,uuid,text),public.mas_submit(text,jsonb,text,text),public.mas_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.mas_command(text,text,uuid,bigint,jsonb,uuid,text),public.mas_submit(text,jsonb,text,text),public.mas_rate_limit(text,integer,integer) to service_role;

-- ============================================================================
-- 3. 202611160003_jobs_storage_reports.sql
-- ============================================================================

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

-- ============================================================================
-- 4. 202611160004_batches.sql
-- ============================================================================

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

-- ============================================================================
-- 5. 202611160005_bootstrap.sql
-- ============================================================================

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

commit;
