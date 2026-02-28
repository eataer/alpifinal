-- Alpi 360 - Catalog RLS policies

alter table if exists public.categories enable row level security;
alter table if exists public.brands enable row level security;
alter table if exists public.products enable row level security;

drop policy if exists categories_rw on public.categories;
create policy categories_rw on public.categories
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists brands_rw on public.brands;
create policy brands_rw on public.brands
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists products_rw on public.products;
create policy products_rw on public.products
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));
