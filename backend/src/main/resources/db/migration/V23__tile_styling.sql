-- Extends the site-wide styling controls (V22) to the "tile" cards used by Schedule (each
-- event), Travel (each hotel/flight), and Things To Do (each item) -- all four currently share
-- one hardcoded look (bg-white, border-ink/10). Nullable, no CHECK: same plain-color precedent
-- as header/site font/background colors -- null means "use today's built-in look".
ALTER TABLE site_settings
  ADD COLUMN tile_bg_color TEXT,
  ADD COLUMN tile_border_color TEXT;
