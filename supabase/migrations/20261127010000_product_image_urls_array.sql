do $$
declare
  has_legacy boolean;
  urls_type text;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'image_url_2'
  ) into has_legacy;

  select data_type into urls_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'products' and column_name = 'image_urls';

  if urls_type is null then
    alter table public.products add column image_urls jsonb;
    urls_type := 'jsonb';
  end if;

  if has_legacy then
    if urls_type = 'ARRAY' then
      update public.products
      set image_urls = array_remove(array[image_url_2, image_url_3, image_url_4], null)
      where image_urls is null and coalesce(image_url_2, image_url_3, image_url_4) is not null;
    else
      update public.products
      set image_urls = to_jsonb(array_remove(array[image_url_2, image_url_3, image_url_4], null))
      where image_urls is null and coalesce(image_url_2, image_url_3, image_url_4) is not null;
    end if;
  end if;
end $$;
