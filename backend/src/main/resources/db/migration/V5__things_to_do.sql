-- Replaces the travel-item list (lodging/transport/airport/other entries) with a Things To Do
-- list. Travel keeps its existing heading/body copy on site_settings -- planners now write
-- travel guidance as a single free-text field instead of maintaining structured item records.
ALTER TABLE site_settings ADD COLUMN things_to_do_heading TEXT, ADD COLUMN things_to_do_body TEXT;

CREATE TABLE thing_to_do_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
  image_id UUID REFERENCES media_asset(id), sort_order INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TABLE travel_item;

UPDATE site_page SET visible = TRUE WHERE slug = 'things-to-do';
