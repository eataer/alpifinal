-- Alpi 360 - Phase 1 Actor Foundation (tenant users + branch assignments)

create table if not exists tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  auth_user_id uuid not null,
  role_id uuid not null references roles(id) on delete restrict,
  email text,
  full_name text,
  status text not null default 'active' check (status in ('invited','active','suspended','terminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, auth_user_id)
);

create index if not exists idx_tenant_users_tenant_status on tenant_users(tenant_id, status);
create index if not exists idx_tenant_users_auth_user on tenant_users(auth_user_id);

create table if not exists user_branches (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references tenant_users(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id, branch_id)
);

create unique index if not exists uq_user_primary_branch
  on user_branches(tenant_id, user_id)
  where is_primary = true and is_active = true;

create index if not exists idx_user_branches_user_active
  on user_branches(tenant_id, user_id, is_active);
