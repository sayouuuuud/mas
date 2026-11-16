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
