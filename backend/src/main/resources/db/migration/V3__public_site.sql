CREATE TABLE media_asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL, size_bytes BIGINT NOT NULL,
  original_name TEXT, uploaded_by UUID REFERENCES planner_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE CHECK (singleton),
  partner_one_name TEXT NOT NULL DEFAULT '', partner_two_name TEXT NOT NULL DEFAULT '',
  wedding_date DATE, display_timezone TEXT NOT NULL DEFAULT 'Asia/Kathmandu',
  hero_image_id UUID REFERENCES media_asset(id), hero_tagline TEXT,
  home_heading TEXT, home_body TEXT,
  travel_heading TEXT, travel_body TEXT,
  schedule_heading TEXT, schedule_body TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO site_settings DEFAULT VALUES;

CREATE TABLE site_page (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, label TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT FALSE, body TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO site_page(slug,label,sort_order,visible) VALUES
  ('home','Home',10,TRUE), ('schedule','Schedule',20,TRUE), ('travel','Travel',30,TRUE),
  ('our-story','Our Story',40,FALSE), ('wedding-party','Wedding Party',50,FALSE),
  ('photos','Photos',60,FALSE), ('things-to-do','Things to Do',70,FALSE),
  ('faq','FAQ',80,FALSE), ('registry','Registry',90,FALSE), ('rsvp','RSVP',100,FALSE);

CREATE TABLE travel_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('LODGING','TRANSPORT','AIRPORT','OTHER')),
  title TEXT NOT NULL, address TEXT, url TEXT, phone TEXT, description TEXT,
  image_id UUID REFERENCES media_asset(id), sort_order INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event ADD COLUMN public_visible BOOLEAN NOT NULL DEFAULT TRUE;
