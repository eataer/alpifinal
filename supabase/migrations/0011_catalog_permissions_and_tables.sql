-- Alpi 360 - Phase 2 Catalog: permissions + categories/brands/products

insert into permissions(key, resource, action)
values
('categories.view', 'categories', 'view'),
('categories.create', 'categories', 'create'),
('categories.update', 'categories', 'update'),
('categories.deactivate', 'categories', 'deactivate'),
('categories.activate', 'categories', 'activate'),
('brands.view', 'brands', 'view'),
('brands.create', 'brands', 'create'),
('brands.update', 'brands', 'update'),
('brands.deactivate', 'brands', 'deactivate'),
('brands.activate', 'brands', 'activate'),
('brands.delete', 'brands', 'delete'),
('products.view', 'products', 'view'),
('products.create', 'products', 'create'),
('products.update', 'products', 'update'),
('products.deactivate', 'products', 'deactivate'),
('products.import', 'products', 'import'),
('products.export', 'products', 'export')
on conflict (key) do nothing;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  parent_id uuid references categories(id) on delete set null,
  category_class text not null default 'product'
    check (category_class in ('product', 'service', 'transaction')),
  stock_behavior text not null default 'none'
    check (stock_behavior in ('decrease', 'increase', 'none')),
  default_tracking_type text not null default 'none'
    check (default_tracking_type in ('none', 'serial', 'imei', 'iccid')),
  product_required boolean not null default false,
  requires_sim boolean not null default false,
  affects_kpi boolean not null default true,
  affects_revenue boolean not null default true,
  vat_rate numeric(5,2),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_categories_root_name
  on categories(tenant_id, lower(name))
  where parent_id is null;

create unique index if not exists uq_categories_child_name
  on categories(tenant_id, parent_id, lower(name));

create index if not exists idx_categories_tenant_active on categories(tenant_id, is_active);
create index if not exists idx_categories_tenant_parent on categories(tenant_id, parent_id);

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_brands_name
  on brands(tenant_id, lower(name));

create index if not exists idx_brands_tenant_active
  on brands(tenant_id, is_active);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  category_id uuid not null references categories(id) on delete restrict,
  brand_id uuid references brands(id) on delete set null,
  model text,
  sku text not null,
  barcode text,
  tracking_type text not null default 'none'
    check (tracking_type in ('none', 'serial', 'imei', 'iccid')),
  sale_price numeric(14,2),
  min_sale_price numeric(14,2),
  cost_price numeric(14,2),
  last_cost_price numeric(14,2),
  vat_rate numeric(5,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create unique index if not exists uq_products_barcode
  on products(tenant_id, barcode)
  where barcode is not null and length(trim(barcode)) > 0;

create index if not exists idx_products_tenant_active on products(tenant_id, is_active);
create index if not exists idx_products_tenant_category on products(tenant_id, category_id);
create index if not exists idx_products_tenant_brand on products(tenant_id, brand_id);
