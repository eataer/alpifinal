-- Alpi 360 - HR RLS policies

alter table if exists public.employees enable row level security;
alter table if exists public.employee_branches enable row level security;

drop policy if exists employees_rw on public.employees;
create policy employees_rw on public.employees
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists employee_branches_rw on public.employee_branches;
create policy employee_branches_rw on public.employee_branches
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));
