-- Lets a planner switch the guest site between the original per-tab routing (each of
-- Home/Schedule/Travel/Things to Do/FAQ its own URL path) and a single-page layout (all of
-- them as anchored sections on one page). A stored setting rather than a build-time flag, so
-- the couple can flip it themselves with no redeploy -- consistent with every other guest-site
-- presentation choice (tab visibility/order/copy/images) already living in this table/site_page.
-- RSVP keeps its own route in both layouts and is not affected by this column.
ALTER TABLE site_settings ADD COLUMN site_layout TEXT NOT NULL DEFAULT 'MULTI_PAGE'
  CHECK (site_layout IN ('MULTI_PAGE','SINGLE_PAGE'));
