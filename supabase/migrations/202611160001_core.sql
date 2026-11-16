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
