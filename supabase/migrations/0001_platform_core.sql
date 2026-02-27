-- Alpi 360 - Phase 1 Core (Platform + Tenant + Entitlement + RBAC Foundation)
-- Note: run in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- 1) plans
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  max_branches integer,
  max_active_users integer,
  created_at timestamptz not null default now()
);

-- 2) features
create table if not exists features (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3) tenants
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subdomain text not null unique,
  package_id uuid references plans(id),
  status text not null check (status in ('active','suspended','trial','cancelled')),

  max_branches integer,
  max_active_users integer,
  max_employees integer,

  subscription_start_date date,
  subscription_end_date date,
  subscription_status text not null default 'trial' check (subscription_status in ('trial','active','suspended','expired','cancelled')),
  grace_period_days integer,
  auto_renew boolean not null default false,
  billing_email text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tenants_status on tenants(status);
create index if not exists idx_tenants_sub_status on tenants(subscription_status);

-- 4) plan_features
create table if not exists plan_features (
  plan_id uuid not null references plans(id) on delete cascade,
  feature_id uuid not null references features(id) on delete cascade,
  is_enabled boolean not null default true,
  primary key (plan_id, feature_id)
);

-- 5) tenant_features (override)
create table if not exists tenant_features (
  tenant_id uuid not null references tenants(id) on delete cascade,
  feature_id uuid not null references features(id) on delete cascade,
  mode text not null check (mode in ('inherit','enable','disable')),
  primary key (tenant_id, feature_id)
);

-- 6) branches (org foundation)
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  code text not null,
  address text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create index if not exists idx_branches_tenant_active on branches(tenant_id, is_active);

-- 7) roles
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  is_system boolean not null default false,
  is_protected boolean not null default false,
  is_editable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

-- 8) permissions + role_permissions
create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  resource text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  scope text not null check (scope in ('entire_company','assigned_region','assigned_branch','self_record','custom_scope')),
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

-- 9) role assignment policy
create table if not exists role_assignment_rules (
  tenant_id uuid not null references tenants(id) on delete cascade,
  assigner_role_id uuid not null references roles(id) on delete cascade,
  assignable_role_id uuid not null references roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, assigner_role_id, assignable_role_id)
);

-- 10) subscription notifications log
create table if not exists subscription_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  type text not null,
  sent_in_app boolean not null default false,
  sent_email boolean not null default false,
  sent_platform boolean not null default false,
  sent_at timestamptz not null default now(),
  unique (tenant_id, type)
);

-- 11) audit logs (minimum)
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  branch_id uuid,
  actor_user_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_tenant_created on audit_logs(tenant_id, created_at desc);

-- 12) starter seed (plans)
insert into plans(name, is_active, max_branches, max_active_users)
values
('Basic', true, 3, 20),
('Pro', true, 10, 100),
('Enterprise', true, null, null)
on conflict (name) do nothing;

-- 13) starter seed (features)
insert into features(key, name, description, is_active)
values
('organization','Organization','Branch and department management', true),
('users_roles','Users & Roles','RBAC and access management', true),
('hr','HR','Employee management', true),
('sales','Sales','Sales entry and tracking', true),
('inventory','Inventory','Stock and serial tracking', true),
('accounting','Accounting','Pre-accounting core', true),
('reports_basic','Reports Basic','Core reports', true)
on conflict (key) do nothing;
