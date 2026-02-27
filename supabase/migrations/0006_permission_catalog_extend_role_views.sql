-- Alpi 360 - Extend permission catalog for role permission reads

insert into permissions(key, resource, action)
values
('role_permissions.view', 'role_permissions', 'view')
on conflict (key) do nothing;
