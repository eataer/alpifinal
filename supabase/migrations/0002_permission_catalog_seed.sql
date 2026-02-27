-- Alpi 360 - Phase 1 RBAC Permission Catalog Seed

insert into permissions(key, resource, action)
values
('branches.view', 'branches', 'view'),
('branches.create', 'branches', 'create'),
('branches.update', 'branches', 'update'),
('branches.deactivate', 'branches', 'deactivate'),
('branches.activate', 'branches', 'activate'),
('branches.transfer_people', 'branches', 'transfer_people'),
('departments.view', 'departments', 'view'),
('departments.create', 'departments', 'create'),
('departments.update', 'departments', 'update'),
('departments.deactivate', 'departments', 'deactivate'),
('roles.view', 'roles', 'view'),
('roles.create', 'roles', 'create'),
('roles.update', 'roles', 'update'),
('roles.deactivate', 'roles', 'deactivate'),
('role_permissions.manage', 'role_permissions', 'manage'),
('role_assignment.manage', 'role_assignment', 'manage')
on conflict (key) do nothing;
