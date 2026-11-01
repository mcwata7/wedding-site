ALTER TABLE site_settings
  ADD COLUMN save_the_date_image_id UUID REFERENCES media_asset(id),
  ADD COLUMN save_the_date_enabled BOOLEAN NOT NULL DEFAULT FALSE;
