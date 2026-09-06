-- The invitation card's image slot changed meaning in this release: it is now a full-bleed
-- background, not a contain-fit box near the top. The old seeded default (a Himalayas line
-- drawing) reads as artwork and looks wrong stretched behind the whole card, so clear it and
-- let MediaSeedService install the new save-the-date background on next boot. Only the seeded
-- id is cleared -- a planner's own uploaded choice is left alone.
UPDATE site_settings SET invitation_image_id = NULL
  WHERE singleton AND invitation_image_id = '00000000-0000-0000-0000-0000000000a1';
