-- Consolidates per-page copy (heading/body/image) onto site_page instead of splitting it
-- across site_settings columns -- the planner previously edited "Travel" copy on the Content
-- tab but "FAQ" copy on the Pages tab for no structural reason. Also turns the wedding date
-- into a start/end range, drops the unused Our Story / Wedding Party / Photos / Registry
-- stubs, and adds structured Travel (hotels/flights) and FAQ item lists.

ALTER TABLE site_page ADD COLUMN heading TEXT;

UPDATE site_page p SET heading = s.home_heading, body = s.home_body
  FROM site_settings s WHERE p.slug = 'home';
UPDATE site_page p SET heading = s.schedule_heading, body = s.schedule_body, image_id = s.schedule_image_id
  FROM site_settings s WHERE p.slug = 'schedule';
UPDATE site_page p SET heading = s.travel_heading, body = s.travel_body, image_id = s.travel_image_id
  FROM site_settings s WHERE p.slug = 'travel';
UPDATE site_page p SET heading = s.things_to_do_heading, body = s.things_to_do_body, image_id = s.things_to_do_image_id
  FROM site_settings s WHERE p.slug = 'things-to-do';

ALTER TABLE site_settings
  DROP COLUMN home_heading, DROP COLUMN home_body,
  DROP COLUMN schedule_heading, DROP COLUMN schedule_body, DROP COLUMN schedule_image_id,
  DROP COLUMN travel_heading, DROP COLUMN travel_body, DROP COLUMN travel_image_id,
  DROP COLUMN things_to_do_heading, DROP COLUMN things_to_do_body, DROP COLUMN things_to_do_image_id;

-- hero_image_id / hero_tagline stay on site_settings -- they're the site-wide hero banner
-- identity, not a specific page's copy; only their editing location moves to the Pages tab.

ALTER TABLE site_settings RENAME COLUMN wedding_date TO wedding_start_date;
ALTER TABLE site_settings ADD COLUMN wedding_end_date DATE;

DELETE FROM site_page WHERE slug IN ('our-story','wedding-party','photos','registry');
UPDATE site_page SET visible = TRUE, sort_order = 50 WHERE slug = 'faq';
UPDATE site_page SET sort_order = 60 WHERE slug = 'rsvp';
-- Resulting order: home 10, schedule 20, travel 30, things-to-do 40, faq 50, rsvp 60.

CREATE TABLE faq_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL, answer TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0, archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE travel_hotel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, address TEXT, url TEXT, description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0, archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- duration/estimated_cost are free text (e.g. "~14h incl. layover", "$900-$1,200 round trip") --
-- planners need ranges and currency symbols, and the budget/FX module was dropped in V16, so
-- there's no numeric currency infrastructure worth reusing here.
CREATE TABLE travel_flight (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name TEXT NOT NULL, duration TEXT, estimated_cost TEXT, description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0, archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
