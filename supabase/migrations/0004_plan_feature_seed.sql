-- Alpi 360 - Seed plan_features mapping

with p as (
  select id, name from plans
), f as (
  select id, key from features
)
insert into plan_features(plan_id, feature_id, is_enabled)
select p.id, f.id, true
from p
join f on (
  (p.name = 'Basic' and f.key in ('organization','users_roles','hr','sales','reports_basic')) or
  (p.name = 'Pro' and f.key in ('organization','users_roles','hr','sales','reports_basic','inventory','accounting')) or
  (p.name = 'Enterprise' and f.key in ('organization','users_roles','hr','sales','reports_basic','inventory','accounting'))
)
on conflict (plan_id, feature_id) do update set is_enabled = excluded.is_enabled;
