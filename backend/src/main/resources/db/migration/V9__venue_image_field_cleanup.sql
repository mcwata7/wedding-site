-- Drop unused venue comparison fields (never populated on any venue so far) and add a photo
-- slot instead, matching the media_asset pattern used for site content elsewhere.
ALTER TABLE venue
  DROP COLUMN location,
  DROP COLUMN pricing,
  DROP COLUMN food_score,
  DROP COLUMN view_score,
  ADD COLUMN image_id UUID REFERENCES media_asset(id);
