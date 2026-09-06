-- More image slots so the planner can place photos throughout the guest site,
-- not just the single home hero: one per dedicated tab, plus one for any
-- generic content page (our-story, wedding-party, faq, etc).
ALTER TABLE site_settings
  ADD COLUMN schedule_image_id UUID REFERENCES media_asset(id),
  ADD COLUMN travel_image_id UUID REFERENCES media_asset(id),
  ADD COLUMN things_to_do_image_id UUID REFERENCES media_asset(id);

ALTER TABLE site_page
  ADD COLUMN image_id UUID REFERENCES media_asset(id);
