-- Integrated catalog/CRM/CMS workflows. No account/role changes or automatic fixture data.
create index if not exists entities_contact on mas.entities((document->>'contactId'),resource) where deleted_at is null;
create index if not exists entities_organization on mas.entities((document->>'organizationId')) where resource='contacts' and deleted_at is null;
create index if not exists entities_contact_phone on mas.entities((document->>'phone')) where resource='contacts' and deleted_at is null;


create or replace function mas.sync_catalog(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare row mas.entities;item jsonb;v mas.variants;vid uuid;key text;ids uuid[]:='{}';published boolean;unit mas.entities;media mas.entities;parent uuid;seen uuid[];updated_variants jsonb:='[]';
begin
 select * into row from mas.entities where id=p_id;
 published:=row.document->>'status'='published';
 delete from mas.entity_links where source_id=p_id;
 if row.resource='products' then
  if published and (row.document->>'categoryId' is null or row.document->>'brandId' is null) then raise exception 'MAS_VALIDATION: published references';end if;
  if row.document->>'categoryId' is not null then unit:=mas.reference((row.document->>'categoryId')::uuid,'categories',published);end if;
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
   if coalesce(item->>'sku','')='' then item:=item||jsonb_build_object('sku','MAS-'||substr(replace(vid::text,'-',''),1,16));end if;
   if not published and item->>'unitId' is null then
    updated_variants:=updated_variants||jsonb_build_array(item||jsonb_build_object('id',vid));
    continue;
   end if;
   unit:=mas.reference((item->>'unitId')::uuid,'units');
   if published and unit.document->>'usage'='measure' then raise exception 'MAS_VALIDATION: selling unit';end if;
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
 elsif row.resource='settings' then perform mas.link(p_id,row.document->>'logoMediaId','company_logo','media');
 elsif row.resource='content' then
  for key in select jsonb_array_elements_text(coalesce(row.published_document->'mediaIds','[]')) loop perform mas.link(p_id,key,'content_media','media');end loop;
  perform mas.link(p_id,row.document->'layout'->>'imageMediaId','content_media','media');
  for item in select value from jsonb_array_elements(coalesce(row.document->'layout'->'cards','[]')) loop perform mas.link(p_id,item->>'imageMediaId','content_media','media');end loop;
  for key in select jsonb_array_elements_text(coalesce(row.document->'mediaIds','[]')||coalesce(row.published_document->'mediaIds','[]')) loop perform mas.link(p_id,key,'content_media','media');end loop;
 end if;

 if row.resource in ('categories','brands','sectors','content','settings') and (published or row.resource='settings') then
  for media in select e.* from mas.entity_links l join mas.entities e on e.id=l.target_id where l.source_id=p_id and e.resource='media' loop
   if media.document->>'status' is distinct from 'ready' or media.document->>'visibility' is distinct from 'public' or media.document->>'kind' is distinct from 'image' then raise exception 'MAS_VALIDATION: public image';end if;
  end loop;
 end if;
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
  return mas.pick(mas.envelope(p_entity),array['id','name','slug','description','parentId','family','logoMediaId','imageMediaId','website','order','group','featured','seoTitle','seoDescription','status'])||jsonb_build_object('media',mas.public_media(jsonb_build_array(p_entity.document->'logoMediaId',p_entity.document->'imageMediaId')));
 elsif p_entity.resource='content' then return mas.pick(mas.envelope(p_entity),array['id','key','name','body','layout','ctaLabel','ctaPath','policyVersion','seoTitle','seoDescription','status'])||jsonb_build_object('media',mas.public_media(p_entity.document->'mediaIds'));
 elsif p_entity.resource='navigation' and (p_entity.document->>'active')::boolean then return mas.pick(mas.envelope(p_entity),array['id','name','path','area','order']);
 elsif p_entity.resource='locations' and (p_entity.document->>'published')::boolean then return mas.pick(mas.envelope(p_entity),array['id','name','kind','address','phone','mapUrl','hours','imageMediaId']);
 elsif p_entity.resource='settings' then return mas.pick(mas.envelope(p_entity),array['id','name','email','phone','whatsapp','support','currency','timezone','responseTarget','logoMediaId','officePhone','fax'])||jsonb_build_object('media',mas.public_media(jsonb_build_array(p_entity.document->'logoMediaId')));
 elsif p_entity.resource='units' and (p_entity.document->>'active')::boolean then return mas.pick(mas.envelope(p_entity),array['id','name','code','precision','usage']);
 elsif p_entity.resource='attributes' then return mas.pick(mas.envelope(p_entity),array['id','name','code','type','scope','unitId','filterable','options','categories']);
 end if;
 return null;
end $$;

create or replace function public.mas_content(p_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_key in ('navigation','locations','settings','units','attributes','categories','brands','sectors') then
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
 if p_filters->>'visibility' is not null and doc->>'visibility' is distinct from p_filters->>'visibility' then return false;end if;
 if p_filters->>'usage'='sale' and doc->>'usage'='measure' then return false;end if;
 if p_filters->>'usage'='measure' and doc->>'usage'='sale' then return false;end if;
 if p_filters->>'kind' is not null and doc->>'kind' is distinct from p_filters->>'kind' then return false;end if;
 if p_filters->>'family' is not null and doc->>'family' is distinct from p_filters->>'family' then return false;end if;
 if p_filters->>'contactId' is not null then
  if p_entity.resource in ('quote_requests','inquiries') and doc->>'contactId' is distinct from p_filters->>'contactId' then return false;end if;
  if p_entity.resource='quotations' and not exists(select 1 from mas.entities r where r.id::text=doc->>'requestId' and r.document->>'contactId'=p_filters->>'contactId') then return false;end if;
 end if;
 if p_filters->>'organizationId' is not null then
  if p_entity.resource='contacts' and doc->>'organizationId' is distinct from p_filters->>'organizationId' then return false;end if;
  if p_entity.resource in ('quote_requests','inquiries','quotations') and not exists(select 1 from mas.entities c where c.resource='contacts' and c.document->>'organizationId'=p_filters->>'organizationId' and c.id::text=case when p_entity.resource='quotations' then (select r.document->>'contactId' from mas.entities r where r.id::text=doc->>'requestId') else doc->>'contactId' end) then return false;end if;
 end if;
 if p_filters->>'requestId' is not null and doc->>'requestId' is distinct from p_filters->>'requestId' then return false;end if;
 if p_filters->>'assignedTo' is not null then
  if p_entity.resource in ('quote_requests','inquiries') and doc->>'assignedTo' is distinct from p_filters->>'assignedTo' then return false;end if;
  if p_entity.resource='quotations' and not exists(select 1 from mas.entities r where r.id::text=doc->>'requestId' and r.document->>'assignedTo'=p_filters->>'assignedTo') then return false;end if;
 end if;
 if p_filters->>'from' is not null and (p_entity.created_at at time zone 'Africa/Cairo')::date<(p_filters->>'from')::date then return false;end if;
 if p_filters->>'to' is not null and (p_entity.created_at at time zone 'Africa/Cairo')::date>(p_filters->>'to')::date then return false;end if;
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


create function mas.sync_crm_links(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare row mas.entities;
begin
 select * into row from mas.entities where id=p_id;
 if row.resource in ('quote_requests','inquiries') then
  delete from mas.entity_links where source_id=p_id and kind='contact';
  perform mas.link(p_id,row.document->>'contactId','contact','contacts');
 elsif row.resource='quotations' then perform mas.link(p_id,row.document->>'requestId','request','quote_requests');
 end if;
end $$;
revoke all on function mas.sync_crm_links(uuid) from public,anon,authenticated;
-- Preserve the reviewed command implementation and add relationship-specific invariants.
alter function public.mas_command(text,text,uuid,bigint,jsonb,uuid,text) rename to mas_command_previous;
revoke all on function public.mas_command_previous(text,text,uuid,bigint,jsonb,uuid,text) from public,anon,authenticated;
create function public.mas_command(p_resource text,p_action text,p_id uuid,p_version bigint,p_data jsonb,p_actor uuid,p_aal text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; staff mas.profiles; row mas.entities; logo mas.entities;
begin
 perform mas.require_service();staff:=mas.staff(p_actor,p_aal);
 if p_action='update' then select * into row from mas.entities where id=p_id and resource=p_resource;
  if row.document->>'importKey' is not null then p_data:=p_data||jsonb_build_object('importKey',row.document->>'importKey');end if;
 end if;
 if p_resource='contacts' and p_action='delete' then
  select * into row from mas.entities where id=p_id and resource='contacts' for update;
  if exists(select 1 from mas.entities where deleted_at is null and resource in ('quote_requests','inquiries') and document->>'contactId'=p_id::text) then raise exception 'MAS_VALIDATION: retained customer history';end if;
 end if;
 if p_resource='units' and p_action='update' and p_data->>'usage'='measure' and exists(select 1 from mas.variants v join mas.entities p on p.id=v.product_id where v.unit_id=p_id and p.document->>'status'='published' and p.deleted_at is null) then raise exception 'MAS_VALIDATION: active dependency';end if;
 result:=public.mas_command_previous(p_resource,p_action,p_id,p_version,p_data,p_actor,p_aal);
 if p_resource='quotations' and p_action='issue' and result->'companySnapshot'->>'logoMediaId' is not null then
  logo:=mas.reference((result->'companySnapshot'->>'logoMediaId')::uuid,'media');
  if logo.document->>'status' is distinct from 'ready' or logo.document->>'visibility' is distinct from 'public' or logo.document->>'kind' is distinct from 'image' then raise exception 'MAS_VALIDATION: company logo';end if;
  update mas.entities set document=jsonb_set(document,'{companySnapshot,logoMedia}',mas.pick(logo.document,array['path','mime'])) where id=(result->>'id')::uuid returning * into row;
  perform mas.link(row.id,logo.id::text,'company_logo','media');result:=mas.envelope(row)||mas.job_meta(row);
 end if;
 if p_resource in ('quote_requests','inquiries','quotations') then
  perform mas.sync_crm_links((result->>'id')::uuid);
  if p_action='convert' then perform mas.sync_crm_links((result->>'convertedRequestId')::uuid);end if;
 elsif p_resource='settings' and p_action in ('create','update') then perform mas.sync_catalog((result->>'id')::uuid);
 end if;
 return result;
end $$;
revoke all on function public.mas_command(text,text,uuid,bigint,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.mas_command(text,text,uuid,bigint,jsonb,uuid,text) to service_role;

-- Match without overwriting an existing canonical customer with unverified visitor input.
create function mas.attach_customer(p_entity uuid) returns void language plpgsql security definer set search_path='' as $$
declare row mas.entities; c jsonb; cid uuid; oid uuid; matches integer; company_name text;
begin
 select * into row from mas.entities where id=p_entity for update;
 if row.resource not in ('quote_requests','inquiries') or row.deleted_at is not null then return;end if;
 if row.document->>'contactId' is not null and exists(select 1 from mas.entities where id=(row.document->>'contactId')::uuid and resource='contacts' and deleted_at is null) then perform mas.sync_crm_links(row.id);return;end if;
 c:=row.document->'customerSnapshot';
 if coalesce(c->>'phone','')='' then return;end if;
 perform pg_advisory_xact_lock(hashtextextended('mas.customer:'||(c->>'phone'),0));
 select count(*),(array_agg(id order by created_at))[1] into matches,cid from mas.entities where resource='contacts' and deleted_at is null and document->>'phone'=c->>'phone';
 if matches>1 then
  update mas.entities set document=document||jsonb_build_object('contactMatch','review') where id=row.id;return;
 elsif matches=0 then
  company_name:=nullif(trim(c->>'company'),'');
  if company_name is not null then
   perform pg_advisory_xact_lock(hashtextextended('mas.organization:'||lower(company_name),0));
   select count(*),(array_agg(id order by created_at))[1] into matches,oid from mas.entities where resource='organizations' and deleted_at is null and lower(trim(document->>'name'))=lower(company_name);
   if matches=0 then insert into mas.entities(resource,document) values('organizations',jsonb_strip_nulls(jsonb_build_object('name',company_name,'city',c->>'city','governorate',c->>'governorate'))) returning id into oid;
   elsif matches>1 then oid:=null;end if;
  end if;
  insert into mas.entities(resource,document) values('contacts',jsonb_strip_nulls(jsonb_build_object('name',c->>'name','phone',c->>'phone','email',c->>'email','organizationId',oid,'preferredChannel',coalesce(c->>'preferredChannel','phone'),'active',true))) returning id into cid;
  perform mas.sync_catalog(cid);
 end if;
 update mas.entities set document=document||jsonb_build_object('contactId',cid,'contactMatch','linked') where id=row.id;
 perform mas.sync_crm_links(row.id);
end $$;
revoke all on function mas.attach_customer(uuid) from public,anon,authenticated;
alter function public.mas_submit(text,jsonb,text,text) rename to mas_submit_previous;
revoke all on function public.mas_submit_previous(text,jsonb,text,text) from public,anon,authenticated;
create function public.mas_submit(p_kind text,p_payload jsonb,p_key text,p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; eid uuid;
begin
 perform mas.require_service();
 result:=public.mas_submit_previous(p_kind,p_payload,p_key,p_hash);
 select id into eid from mas.entities where document->>'reference'=result->>'reference' and resource=case when p_kind='request' then 'quote_requests' else 'inquiries' end;
 perform mas.attach_customer(eid);
 return result;
end $$;
revoke all on function public.mas_submit(text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.mas_submit(text,jsonb,text,text) to service_role;
-- Repair existing references without changing the historical customer snapshots.
do $$declare r record;begin for r in select id from mas.entities where resource in ('quote_requests','inquiries') and deleted_at is null loop perform mas.attach_customer(r.id);end loop;end$$;

create or replace function public.mas_reports(p_filters jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare staff mas.profiles; result jsonb;
begin
 staff:=mas.staff(auth.uid());
 with visible as materialized(select * from mas.entities e where e.resource in ('quote_requests','inquiries','quotations') and e.deleted_at is null and mas.can_read(e,staff) and mas.matches(e,p_filters)),
 requests as materialized(select * from visible where resource='quote_requests'),
 states as(select document->>'status' status,count(*) count from requests group by 1),
 sources as(select coalesce(document->'source'->>'utmSource','direct') source,count(*) count from requests group by 1)
 select jsonb_build_object('total',(select count(*) from requests),'requests',(select count(*) from requests),'inquiries',(select count(*) from visible where resource='inquiries'),'quotations',(select count(*) from visible where resource='quotations'),'byStatus',coalesce((select jsonb_object_agg(status,count) from states),'{}'),'bySource',coalesce((select jsonb_object_agg(source,count) from sources),'{}'),'overdueFollowUps',(select count(*) from requests where (document->>'followUpAt')::timestamptz<now() and document->>'status' not in ('won','lost','cancelled')),'unassigned',(select count(*) from requests where document->>'assignedTo' is null)) into result;
 return result;
end $$;

-- Idempotent import of the user-approved legacy content. Only the server can call
-- this initializer. Existing natural keys and later admin edits are never overwritten.
create function public.mas_import_initial(p_resource text,p_data jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row mas.entities;doc jsonb; new_id uuid;
begin
 perform mas.require_service();
 if p_resource not in ('settings','locations','navigation','units','categories','brands','sectors','content','media') or length(p_key) not between 1 and 200 then raise exception 'MAS_VALIDATION';end if;
 perform pg_advisory_xact_lock(hashtextextended('mas.initial-content',0));
 select * into row from mas.entities e where resource=p_resource and deleted_at is null and (
 document->>'importKey'=p_key or p_resource='settings' or
 (p_resource in ('categories','brands','sectors') and document->>'slug'=p_data->>'slug') or
 (p_resource='units' and document->>'code'=p_data->>'code') or
 (p_resource='content' and document->>'key'=p_data->>'key')) limit 1;
 if row.id is not null then return mas.envelope(row)||jsonb_build_object('imported',false);end if;
 new_id:=gen_random_uuid();doc:=p_data||jsonb_build_object('importKey',p_key);
 if p_resource='media' then doc:=doc||jsonb_build_object('status','uploading','storagePath','initial/'||new_id::text);
 elsif p_resource in ('categories','brands','sectors','content') then doc:=doc||jsonb_build_object('status','published','publishedAt',now());end if;
 -- Legal publication is a separate reviewed action; never auto-publish a draft.
 if p_resource='content' and doc->>'key' in ('privacy','terms') then raise exception 'MAS_VALIDATION: legal content requires explicit publication';end if;
 insert into mas.entities(id,resource,document,published_document) values(new_id,p_resource,doc,case when p_resource='content' then doc else null end) returning * into row;
 if p_resource in ('categories','brands','sectors','content','settings') then perform mas.sync_catalog(row.id);end if;
 insert into mas.audit_logs(resource,entity_id,action,after_version,detail) values(p_resource,row.id,'initial_import',1,jsonb_build_object('importKey',p_key));
 return mas.envelope(row)||jsonb_build_object('imported',true);
end $$;
revoke all on function public.mas_import_initial(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.mas_import_initial(text,jsonb,text) to service_role;

create function public.mas_queue_initial_media(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare row mas.entities;
begin
 perform mas.require_service();select * into row from mas.entities where id=p_id and resource='media' and deleted_at is null for update;
 if row.id is null or row.document->>'importKey' is null then raise exception 'MAS_NOT_FOUND';end if;
 if row.document->>'status'='uploading' then
  update mas.entities set document=document||jsonb_build_object('status','quarantined'),version=version+1,updated_at=now() where id=p_id returning * into row;
  insert into mas.jobs(kind,entity_id) values('scan_media',p_id);
 end if;
 return mas.envelope(row);
end $$;
revoke all on function public.mas_queue_initial_media(uuid) from public,anon,authenticated;
grant execute on function public.mas_queue_initial_media(uuid) to service_role;


create function mas.entity_meta(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare row mas.entities; result jsonb:='{}';
begin
 select * into row from mas.entities where id=p_id;
 if row.resource in ('categories','brands','sectors') then
  select jsonb_build_object('productCount',count(*)) into result from mas.entities p where p.resource='products' and p.deleted_at is null and (case row.resource when 'categories' then mas.matches(p,jsonb_build_object('category',jsonb_build_array(row.id))) when 'brands' then p.document->>'brandId'=row.id::text else coalesce(p.document->'sectorIds','[]') ? row.id::text end);
 elsif row.resource in ('contacts','organizations') then
  with contacts as(select c.id from mas.entities c where c.resource='contacts' and c.deleted_at is null and (c.id=p_id or c.document->>'organizationId'=p_id::text)), requests as(select r.id,r.resource from mas.entities r where r.resource in ('quote_requests','inquiries') and r.deleted_at is null and r.document->>'contactId' in(select id::text from contacts))
  select jsonb_build_object('contactCount',(select count(*) from contacts),'requestCount',(select count(*) from requests where resource='quote_requests'),'inquiryCount',(select count(*) from requests where resource='inquiries'),'quotationCount',(select count(*) from mas.entities q where q.resource='quotations' and q.deleted_at is null and q.document->>'requestId' in(select id::text from requests))) into result;
 elsif row.resource='products' then
  result:=jsonb_build_object('categoryName',(select document->'name' from mas.entities where id::text=row.document->>'categoryId'),'brandName',(select document->'name' from mas.entities where id::text=row.document->>'brandId'));
 elsif row.resource='media' then
  select jsonb_build_object('usedBy',coalesce(jsonb_agg(jsonb_build_object('id',e.id,'resource',e.resource,'name',coalesce(e.document->'name',to_jsonb(e.document->>'key')))),'[]')) into result from mas.entity_links l join mas.entities e on e.id=l.source_id and e.deleted_at is null where l.target_id=p_id;
 end if;
 return coalesce(result,'{}');
end $$;
revoke all on function mas.entity_meta(uuid) from public,anon,authenticated;
alter function public.mas_get(text,text,boolean) rename to mas_get_previous;
revoke all on function public.mas_get_previous(text,text,boolean) from public,anon,authenticated;
create function public.mas_get(p_resource text,p_id text,p_private boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.mas_get_previous(p_resource,p_id,p_private);
 if p_private and result is not null then result:=result||mas.entity_meta((result->>'id')::uuid);end if;
 return result;
end $$;
revoke all on function public.mas_get(text,text,boolean) from public;
grant execute on function public.mas_get(text,text,boolean) to anon,authenticated;
alter function public.mas_list(text,jsonb,boolean) rename to mas_list_previous;
revoke all on function public.mas_list_previous(text,jsonb,boolean) from public,anon,authenticated;
create function public.mas_list(p_resource text,p_filters jsonb default '{}',p_private boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; rows jsonb;
begin
 result:=public.mas_list_previous(p_resource,p_filters,p_private);
 if p_private and p_resource in ('products','categories','brands','sectors','contacts','organizations','media') then
  select coalesce(jsonb_agg(v||mas.entity_meta((v->>'id')::uuid)),'[]') into rows from jsonb_array_elements(result->'data') v;
  result:=jsonb_set(result,'{data}',rows);
 elsif p_private and p_resource='audit_logs' then
  select coalesce(jsonb_agg(v||jsonb_build_object('actorName',(select display_name from mas.profiles where id::text=v->>'actor_id'),'entityName',(select coalesce(document->'name',document->'reference',document->'key') from mas.entities where id::text=v->>'entity_id'))),'[]') into rows from jsonb_array_elements(result->'data') v;
  result:=jsonb_set(result,'{data}',rows);
 end if;
 return result;
end $$;
revoke all on function public.mas_list(text,jsonb,boolean) from public;
grant execute on function public.mas_list(text,jsonb,boolean) to anon,authenticated;

