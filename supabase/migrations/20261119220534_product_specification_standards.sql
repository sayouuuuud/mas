-- Expose the product's standards in the existing public projection.
create or replace function mas.public_entity(p_entity mas.entities) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; variants jsonb;
begin
 if p_entity.deleted_at is not null then return null;end if;
 if p_entity.resource='content' and p_entity.published_document is not null then p_entity.document:=p_entity.published_document;end if;
 if p_entity.resource in ('products','categories','brands','sectors','content') and p_entity.document->>'status'<>'published' then return null;end if;
 if p_entity.resource='products' then
  result:=mas.pick(mas.envelope(p_entity),array['id','slug','name','summary','description','applications','benefits','categoryId','brandId','family','featured','modelCode','mainMediaId','sectorIds','relatedIds','standards','specifications','seoTitle','seoDescription','publishedAt','status']);
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
