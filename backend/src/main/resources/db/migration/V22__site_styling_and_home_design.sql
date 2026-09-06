-- Site-wide styling (planner-configurable header/site font+color+background) and a
-- Home-page "fully designed" override. All nullable except home_design_only: null means
-- "use today's built-in look" -- same fail-safe idiom as site_layout (V21), but note the
-- *parse helpers* in InternalDataController must preserve null (not substitute a schema
-- default) since these columns don't have one -- unlike site_layout's NOT NULL DEFAULT.
--
-- No CHECK on the two font-family columns: the font list is a frontend asset set that's
-- expected to grow, and site_settings is the only writer (already 400s on an unknown
-- value) -- a DB CHECK would force a migration to add an 11th font. font_size IS a
-- closed 3-value set (matches site_layout's use of CHECK for a true enum).
ALTER TABLE site_settings
  ADD COLUMN header_font_family TEXT,
  ADD COLUMN header_font_color TEXT,
  ADD COLUMN header_font_size TEXT CHECK (header_font_size IN ('SMALL','MEDIUM','LARGE')),
  ADD COLUMN header_bg_color TEXT,
  ADD COLUMN site_font_family TEXT,
  ADD COLUMN site_font_color TEXT,
  ADD COLUMN site_font_size TEXT CHECK (site_font_size IN ('SMALL','MEDIUM','LARGE')),
  ADD COLUMN site_bg_color TEXT,
  ADD COLUMN home_design_image_id UUID REFERENCES media_asset(id),
  ADD COLUMN home_design_only BOOLEAN NOT NULL DEFAULT FALSE;
