-- Alpi 360 - Phase 2 HR: permission catalog + employee tables

insert into permissions(key, resource, action)
values
('employees.view', 'employees', 'view'),
('employees.create', 'employees', 'create'),
('employees.update', 'employees', 'update'),
('employees.suspend', 'employees', 'suspend'),
('employees.terminate', 'employees', 'terminate'),
('employees.assign_branches', 'employees', 'assign_branches'),
('employees.set_primary_branch', 'employees', 'set_primary_branch'),
('employees.invite_user', 'employees', 'invite_user')
on conflict (key) do nothing;

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_no text,
  first_name text not null,
  last_name text not null,
  full_name text generated always as (trim(first_name || ' ' || last_name)) stored,
  phone text,
  email text,
  department_id uuid references departments(id) on delete set null,
  primary_branch_id uuid references branches(id) on delete set null,
  tenant_user_id uuid unique references tenant_users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'suspended', 'terminated')),
  hire_date date,
  terminated_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, employee_no)
);

create index if not exists idx_employees_tenant_status on employees(tenant_id, status);
create index if not exists idx_employees_tenant_branch on employees(tenant_id, primary_branch_id);
create index if not exists idx_employees_tenant_department on employees(tenant_id, department_id);

create table if not exists employee_branches (
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, employee_id, branch_id)
);

create unique index if not exists uq_employee_primary_branch
  on employee_branches(tenant_id, employee_id)
  where is_primary = true and is_active = true;

create index if not exists idx_employee_branches_employee_active
  on employee_branches(tenant_id, employee_id, is_active);
