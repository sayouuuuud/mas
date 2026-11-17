\set ON_ERROR_STOP on
begin;
create function public.test_assert(condition boolean,label text) returns void language plpgsql as $$begin if condition is distinct from true then raise exception 'FAILED: %',label;end if;raise notice 'PASS: %',label;end$$;
create function public.test_throws(statement text,expected text,label text) returns void language plpgsql as $$
begin
 begin execute statement;exception when others then
  if position(expected in sqlerrm)>0 then raise notice 'PASS: %',label;return;end if;
  raise exception 'FAILED: %, unexpected error %',label,sqlerrm;
 end;raise exception 'FAILED: %, no exception',label;
end$$;

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000001','owner@example.test'),
 ('00000000-0000-4000-8000-000000000002','agent@example.test'),
 ('00000000-0000-4000-8000-000000000003','other@example.test');
insert into mas.profiles(id,display_name,roles) values
 ('00000000-0000-4000-8000-000000000001','Test Owner',array['Owner']),
 ('00000000-0000-4000-8000-000000000002','Test Admin',array['Admin']),
 ('00000000-0000-4000-8000-000000000003','Other Agent',array['Sales Agent']);

select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
<<integration>>
declare owner_id uuid:='00000000-0000-4000-8000-000000000001';agent_id uuid:='00000000-0000-4000-8000-000000000002';
 unit jsonb;category jsonb;brand jsonb;media jsonb;product jsonb;variant uuid;privacy jsonb;request jsonb;response jsonb;retry jsonb;quotation jsonb;revision jsonb;job jsonb;payload jsonb;reference_value text;request_id uuid;current_version bigint;
begin
 unit:=public.mas_command('units','create',null,null,'{"name":{"ar":"قطعة","en":"Piece"},"code":"piece","precision":0,"active":true}',owner_id,'aal2');
 privacy:=public.mas_command('content','create',null,null,'{"key":"privacy","name":{"ar":"الخصوصية","en":"Privacy"},"body":{"ar":"سياسة تجريبية","en":"Test policy"},"status":"draft","policyVersion":"v1","mediaIds":[]}',owner_id,'aal2');
 perform public.mas_command('content','publish',(privacy->>'id')::uuid,1,'{}',owner_id,'aal2');
 privacy:=public.mas_command('content','update',(privacy->>'id')::uuid,2,(privacy-array['id','version','createdAt','updatedAt'])||'{"policyVersion":"v2","body":{"ar":"مسودة جديدة","en":"New draft"}}'::jsonb,owner_id,'aal2');
 perform public.test_assert(public.mas_content('privacy')->>'policyVersion'='v1','editing content draft preserves published version');
 perform public.test_assert((select count(*) from mas.policy_versions where version='v1')=1,'published legal policy version retained');
 perform public.mas_command('settings','create',null,null,'{"name":{"ar":"إم إيه إس","en":"MAS"},"email":"company@example.test","phone":"+201012345678","whatsapp":"+201012345678","currency":"EGP","timezone":"Africa/Cairo"}',owner_id,'aal2');
 category:=public.mas_command('categories','create',null,null,'{"name":{"ar":"زيوت","en":"Oils"},"slug":"oils","status":"draft"}',owner_id,'aal2');
 category:=public.mas_command('categories','publish',(category->>'id')::uuid,1,'{}',owner_id,'aal2');
 brand:=public.mas_command('brands','create',null,null,'{"name":{"ar":"علامة","en":"Brand"},"slug":"brand","status":"draft"}',owner_id,'aal2');
 brand:=public.mas_command('brands','publish',(brand->>'id')::uuid,1,'{}',owner_id,'aal2');
 media:=public.mas_command('media','create',null,null,'{"name":"image.webp","storagePath":"test/image","mime":"image/webp","size":100,"kind":"image","visibility":"public","alt":{"ar":"زيت","en":"Oil"}}',owner_id,'aal2');
 perform public.mas_command('media','complete_upload',(media->>'id')::uuid,1,'{}',owner_id,'aal2');
 job:=public.mas_claim_jobs(1)->0;
 perform public.test_throws(format('select public.mas_finish_job(%L,%L,%L,null)',job->>'id',gen_random_uuid(),'{}'),'MAS_CONFLICT','stale worker lease rejected');
 perform public.mas_finish_job((job->>'id')::uuid,(job->>'leaseToken')::uuid,'{"path":"test/clean.webp","mime":"image/webp","size":80,"sha256":"test"}',null);
 product:=public.mas_command('products','create',null,null,jsonb_build_object('name',jsonb_build_object('ar','زيت صناعي','en','Industrial oil'),'slug','industrial-oil','summary',jsonb_build_object('ar','وصف عربي','en','English summary'),'description',jsonb_build_object('ar','تفاصيل المنتج','en','Product details'),'family','oils','status','draft','categoryId',category->>'id','brandId',brand->>'id','mainMediaId',media->>'id','variants',jsonb_build_array(jsonb_build_object('sku','TEST-SKU','label',jsonb_build_object('ar','عبوة','en','Pack'),'unitId',unit->>'id','minQuantity',2,'quantityStep',2,'active',true,'availability','available')),'sourceNote','CONFIDENTIAL_INTERNAL'),owner_id,'aal2');
 perform public.test_assert(public.mas_get('products',product->>'id',false) is null,'draft product is not public');
 product:=public.mas_command('products','publish',(product->>'id')::uuid,1,'{}',owner_id,'aal2');
 variant:=(product->'variants'->0->>'id')::uuid;
 perform public.test_throws(format('select public.mas_command(%L,%L,%L,3,%L,%L,%L)','media','update',media->>'id','{"name":"image.webp","alt":{"ar":"","en":""}}',owner_id,'aal2'),'MAS_VALIDATION','published main image retains bilingual alt text');
 perform public.test_throws(format('select public.mas_command(%L,%L,%L,1,%L,%L,%L)','units','update',unit->>'id','{"name":{"ar":"قطعة","en":"Piece"},"code":"piece","precision":3,"active":true}',owner_id,'aal2'),'MAS_VALIDATION','published variant prevents incompatible unit changes');
 perform public.test_throws(format('select public.mas_command(%L,%L,null,null,%L,%L,%L)','attributes','create',jsonb_build_object('name',jsonb_build_object('ar','لزوجة','en','Viscosity'),'code','viscosity','type','number','scope','product','filterable',true,'categories',jsonb_build_array(jsonb_build_object('categoryId',category->>'id','required',true,'min',1)),'options','[]'::jsonb),owner_id,'aal2'),'MAS_VALIDATION','new required specifications require review of published products');

 perform public.test_assert(public.mas_get('products','industrial-oil',false)->>'sourceNote' is null,'public RPC strips internal notes');
 perform public.test_assert((public.mas_list('products','{}',false)->>'total')::int=1,'published catalog pagination total');
 perform public.test_assert((public.mas_facets('{}')->>'total')::int=1,'catalog facets count published products');
 perform public.test_assert((public.mas_list('products','{"q":"CONFIDENTIAL_INTERNAL"}',false)->>'total')::int=0,'public search cannot probe internal notes');
 perform public.test_throws(format('select public.mas_bulk_products(%L,%L,%L,%L)','archive',jsonb_build_array(jsonb_build_object('id',product->>'id','version',2),jsonb_build_object('id',product->>'id','version',999)),owner_id,'aal2'),'MAS_CONFLICT','bulk operation rejects one stale item');
 perform public.test_assert((select document->>'status' from mas.entities where id=(product->>'id')::uuid)='published','bulk conflict rolls back all earlier changes');
 perform public.test_throws(format('select public.mas_import_products(%L,%L,%L)',jsonb_build_array((product-array['id','version','createdAt','updatedAt'])||jsonb_build_object('slug','import-one','status','draft','variants',jsonb_build_array(((product->'variants'->0)-'id')||'{"sku":"IMPORT-UNIQUE"}'::jsonb)),(product-array['id','version','createdAt','updatedAt'])||jsonb_build_object('slug','import-two','status','draft','variants',jsonb_build_array((product->'variants'->0)-'id'))),owner_id,'aal2'),'duplicate key value','import rejects a conflicting SKU');
 perform public.test_assert(not exists(select 1 from mas.entities where document->>'slug'='import-one'),'failed import rolls back earlier product drafts');
 perform public.test_throws(format('select public.mas_command(%L,%L,%L,1,%L,%L,%L)','products','archive',product->>'id','{}',owner_id,'aal2'),'MAS_CONFLICT','stale catalog version conflicts');
 perform public.test_throws(format('select public.mas_command(%L,%L,%L,2,%L,%L,%L)','categories','archive',category->>'id','{}',owner_id,'aal2'),'MAS_VALIDATION','published dependency cannot be archived');
 payload:=jsonb_build_object('locale','ar','customer',jsonb_build_object('name','Test Customer','phone','+201012345678'),'items',jsonb_build_array(jsonb_build_object('variantId',variant,'quantity',4,'unitCode','piece')),'privacy',jsonb_build_object('accepted',true,'policyVersion','v1'),'source',jsonb_build_object('page','/ar/request-quote'));
 response:=public.mas_submit('request',payload,'integration-key-0001','payloadhash');retry:=public.mas_submit('request',payload,'integration-key-0001','payloadhash');
 perform public.test_assert(response->>'reference'=retry->>'reference' and (retry->>'replayed')::boolean,'submission idempotency replays same receipt');
 perform public.test_throws(format('select public.mas_submit(%L,%L,%L,%L)','request',jsonb_set(payload,'{items,0,quantity}','3'),'integration-invalid-1','invalidhash'),'MAS_VALIDATION','database rejects stale quantity rules');
 perform public.test_assert((select count(*) from mas.entities where resource='quote_requests')=1,'failed submission leaves no partial request');
 perform public.test_throws(format('select public.mas_submit(%L,%L,%L,%L)','request',payload,'integration-key-0001','changedhash'),'MAS_CONFLICT','idempotency rejects payload replacement');
 select id into request_id from mas.entities where document->>'reference'=response->>'reference';
 perform public.test_assert((select count(*) from mas.sales_items where mas.sales_items.request_id=integration.request_id)=1,'one canonical request item persisted');
 request:=public.mas_command('quote_requests','assign',request_id,1,jsonb_build_object('assignedTo',agent_id),owner_id,'aal2');
 perform public.test_assert(request->>'status'='assigned','assignment updates request state atomically');
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',agent_id,'aal','aal2')::text,true);
 perform public.test_assert(public.mas_get('quote_requests',request_id::text,true) is not null,'Admin with MFA can read request');
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',agent_id,'aal','aal1')::text,true);
 perform public.test_assert(public.mas_actor()->>'id'=agent_id::text,'Admin may read own authentication profile before MFA setup');
 perform public.test_throws(format('select public.mas_get(%L,%L,true)','quote_requests',request_id),'MAS_MFA_REQUIRED','Admin without MFA cannot read private records');
 perform set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
 perform public.test_throws(format('select public.mas_get(%L,%L,true)','quote_requests',request_id),'MAS_FORBIDDEN','legacy non-admin cannot read request');
 perform public.test_throws('select public.mas_list(''quote_requests'',''{}'',true)','MAS_FORBIDDEN','legacy non-admin cannot list private requests');
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform public.test_throws(format('select public.mas_command(%L,%L,%L,2,%L,%L,%L)','quote_requests','assign',request_id,jsonb_build_object('assignedTo',agent_id),'00000000-0000-4000-8000-000000000003','aal2'),'MAS_FORBIDDEN','legacy non-admin cannot assign requests');
 request:=public.mas_command('quote_requests','transition',request_id,2,'{"status":"in_progress","reason":""}',agent_id,'aal2');
 quotation:=public.mas_command('quotations','create',null,null,jsonb_build_object('requestId',request_id,'locale','ar','currency','EGP','validUntil','2099-01-01','leadTime','One week','terms','Payment on delivery','lines',jsonb_build_array(jsonb_build_object('description','Oil','sku','TEST-SKU','quantity',2,'unit','piece','price','10','discount','0','tax','14')),'totals',jsonb_build_object('net',2000,'tax',280,'total',2280)),agent_id,'aal2');
 quotation:=public.mas_command('quotations','issue',(quotation->>'id')::uuid,1,'{}',agent_id,'aal2');
 perform public.test_assert(quotation->>'number' is not null and quotation->>'status'='issued','quotation issuance allocates a number');
 perform public.test_assert(quotation->>'pdfStatus'='processing','issued quotation reports PDF processing state');
 perform public.test_assert((public.mas_retry_job('quotations',(quotation->>'id')::uuid,owner_id,'aal2')->>'pdfStatus')='processing','admin can safely retry quotation PDF job without mutating snapshot');
 perform public.test_throws(format('select public.mas_command(%L,%L,%L,2,%L,%L,%L)','products','delete',product->>'id','{}',owner_id,'aal2'),'MAS_VALIDATION','published product cannot be deleted directly');
 perform public.test_throws(format('select public.mas_command(%L,%L,%L,2,%L,%L,%L)','quotations','update',quotation->>'id','{}',agent_id,'aal2'),'MAS_VALIDATION','issued quotations are immutable');
 revision:=public.mas_command('quotations','revise',(quotation->>'id')::uuid,2,'{}',agent_id,'aal2');
 perform public.test_assert(revision->>'revision'='2' and revision->>'number'=quotation->>'number','revision preserves series number');
 perform public.test_assert((select document->>'status' from mas.entities where id=(quotation->>'id')::uuid)='issued','prior issued revision preserved');
 perform public.mas_command('quotations','sent',(quotation->>'id')::uuid,3,'{"channel":"email"}',agent_id,'aal2');
 perform public.test_throws(format('select public.mas_command(%L,%L,%L,3,%L,%L,%L)','quote_requests','transition',request_id,'{"status":"won"}',agent_id,'aal2'),'MAS_VALIDATION','request cannot skip quotation status');
 perform public.test_assert((public.mas_rate_limit(repeat('a',64),1,60)->>'allowed')::boolean,'first rate limit token allowed');
 perform public.test_assert(not (public.mas_rate_limit(repeat('a',64),1,60)->>'allowed')::boolean,'persistent rate limit blocks excess');
 perform public.test_throws(format('select public.mas_command(%L,%L,%L,null,%L,%L,%L)','units','create',null,'{}',owner_id,'aal1'),'MAS_MFA_REQUIRED','owner without MFA cannot mutate');
 perform public.test_assert((public.mas_health()->>'ready')::boolean,'health requires owner policy settings and unit');
 perform public.test_throws(format('select public.mas_command(%L,%L,%L,1,%L,%L,%L)','profiles','update_staff',owner_id,'{"displayName":"Test Owner","active":false,"roles":["Owner"]}',owner_id,'aal2'),'MAS_VALIDATION','owner cannot disable their own account');
 perform public.mas_command('profiles','update_staff',agent_id,1,'{"displayName":"Test Agent","active":false,"roles":["Admin"]}',owner_id,'aal2');
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',agent_id,'aal','aal2')::text,true);
 perform public.test_throws('select public.mas_actor()','MAS_FORBIDDEN','disabled staff immediately lose access with an existing JWT');
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
end $$;

set local role anon;
select public.test_throws('select * from mas.entities','permission denied','anon cannot select private tables');
select public.test_throws('select public.mas_command(''units'',''create'',null,null,''{}'',''00000000-0000-4000-8000-000000000001'',''aal2'')','permission denied','anon cannot invoke privileged writes');
select public.test_throws('select public.mas_actor()','permission denied','anon cannot fetch staff profile');
reset role;
set local role authenticated;
select public.test_throws('select * from mas.profiles','permission denied','authenticated SDK cannot read arbitrary staff');
select public.test_throws('select public.mas_submit(''request'',''{}'',''integration-key-2222'',''hash'')','permission denied','authenticated SDK cannot bypass server submission validation');
reset role;
select public.test_assert((select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='mas' and c.relkind='r'),'all application tables have RLS');
rollback;
