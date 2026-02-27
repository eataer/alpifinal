-- Alpi 360 - Extend permission catalog for users/roles module endpoints

insert into permissions(key, resource, action)
values
('permissions.view', 'permissions', 'view')
on conflict (key) do nothing;
