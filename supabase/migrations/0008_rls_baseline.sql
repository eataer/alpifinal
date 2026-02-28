-- Alpi 360 - Phase 1 Baseline RLS Policies
-- Note: service_role bypasses RLS. These policies protect direct anon/authenticated access.

create or replace function public.current_tenant_ids()
returns setof uuid
language sql
stable
as $$
  select tu.tenant_id
  from public.tenant_users tu
  where tu.auth_user_id = auth.uid()
    and tu.status in ('active', 'invited');
$$;

-- Tenant-scoped tables
alter table if exists public.tenants enable row level security;
alter table if exists public.tenant_features enable row level security;
alter table if exists public.branches enable row level security;
alter table if exists public.departments enable row level security;
alter table if exists public.roles enable row level security;
alter table if exists public.role_permissions enable row level security;
alter table if exists public.role_assignment_rules enable row level security;
alter table if exists public.tenant_users enable row level security;
alter table if exists public.user_branches enable row level security;
alter table if exists public.audit_logs enable row level security;
alter table if exists public.subscription_notifications enable row level security;

-- Global catalog tables
alter table if exists public.permissions enable row level security;
alter table if exists public.features enable row level security;
alter table if exists public.plans enable row level security;
alter table if exists public.plan_features enable row level security;

drop policy if exists tenant_self_read on public.tenants;
create policy tenant_self_read on public.tenants
for select to authenticated
using (id in (select public.current_tenant_ids()));

drop policy if exists tenant_features_rw on public.tenant_features;
create policy tenant_features_rw on public.tenant_features
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists branches_rw on public.branches;
create policy branches_rw on public.branches
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists departments_rw on public.departments;
create policy departments_rw on public.departments
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists roles_rw on public.roles;
create policy roles_rw on public.roles
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists role_permissions_rw on public.role_permissions;
create policy role_permissions_rw on public.role_permissions
for all to authenticated
using (
  exists (
    select 1
    from public.roles r
    where r.id = role_id
      and r.tenant_id in (select public.current_tenant_ids())
  )
)
with check (
  exists (
    select 1
    from public.roles r
    where r.id = role_id
      and r.tenant_id in (select public.current_tenant_ids())
  )
);

drop policy if exists role_assignment_rules_rw on public.role_assignment_rules;
create policy role_assignment_rules_rw on public.role_assignment_rules
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists tenant_users_rw on public.tenant_users;
create policy tenant_users_rw on public.tenant_users
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists user_branches_rw on public.user_branches;
create policy user_branches_rw on public.user_branches
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists audit_logs_rw on public.audit_logs;
create policy audit_logs_rw on public.audit_logs
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists subscription_notifications_rw on public.subscription_notifications;
create policy subscription_notifications_rw on public.subscription_notifications
for all to authenticated
using (tenant_id in (select public.current_tenant_ids()))
with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions
for select to authenticated
using (true);

drop policy if exists features_read on public.features;
create policy features_read on public.features
for select to authenticated
using (true);

drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans
for select to authenticated
using (true);

drop policy if exists plan_features_read on public.plan_features;
create policy plan_features_read on public.plan_features
for select to authenticated
using (true);
