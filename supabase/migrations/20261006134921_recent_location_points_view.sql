-- Public read-only view of the 100 most recent location points.
-- Runs with the view owner's privileges (not security_invoker), so it bypasses
-- the base table's RLS while the base table itself stays protected. Anyone with
-- the anon key can read these rows, so only expose what you're happy to make public.
create view public.recent_location_points as
select
  id,
  user_id,
  latitude,
  longitude,
  accuracy,
  altitude,
  speed,
  heading,
  recorded_at,
  created_at
from public.location_points
order by recorded_at desc
limit 100;

grant select on public.recent_location_points to anon, authenticated;
