-- Optional: example reports so the leaderboard isn't empty when you first demo the app.
-- Run in Supabase → SQL Editor AFTER schema.sql.
-- They only count for the current week, so they drop off the leaderboard next Monday.
-- To delete them early:  delete from public.reports where reporter_name like 'Demo %';

insert into public.reports
  (reporter_name, reporter_year, is_anonymous, year_group, issues, days, details)
values
  ('Demo Student',  9, true,  11, array['Cutting in line'], array['Thu'], 'Someone joined their friends halfway down the line.'),
  ('Demo Student',  8, true,   7, array['Cutting in line'], array['Wed'], null),
  ('Demo Priya',   10, false,  7, array['Long wait'],       array['Mon'], 'Line went right out the door for 20 minutes.'),
  ('Demo Student',  8, true,   7, array['Long wait'],       array['Thu', 'Fri'], null),
  ('Demo Student', 11, true,   9, array['Shoving'],         array['Tue'], 'People pushing forward when the doors opened.'),
  ('Demo Jordan',  12, false,  9, array['Cutting in line'], array['Thu'], null),
  ('Demo Student',  9, true,   8, array['Shoving', 'Cutting in line'], array['Mon', 'Wed'], 'A few people saved spaces for a big group.'),
  ('Demo Sam',      7, false,  8, array['Long wait'],       array['Tue'], 'Waited about 25 minutes and only had 10 minutes to eat.'),
  ('Demo Student', 11, true,  10, array['Shoving'],         array['Mon', 'Thu'], 'People at the back kept pushing forward when the line moved.'),
  ('Demo Student',  9, true,  10, array['Shoving'],         array['Fri'], null),
  ('Demo Student', 13, true,  12, array['Shoving', 'Cutting in line'], array['Tue'], 'A group pushed in near the front just as the doors opened.'),
  ('Demo Ruby',     7, false, 12, array['Cutting in line'], array['Mon'], null),
  ('Demo Student', 10, true,  12, array['Long wait', 'Cutting in line'], array['Wed', 'Fri'], null),
  ('Demo Student', 12, true,  13, array['Shoving'],         array['Wed'], null),
  ('Demo Noah',    11, false, 13, array['Cutting in line', 'Shoving'], array['Tue', 'Thu'], 'Same people cut in every day this week.'),
  ('Demo Student',  8, true,  13, array['Long wait'],       array['Mon'], null);
