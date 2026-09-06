ALTER TABLE site_settings
  ADD COLUMN invitation_header1 TEXT NOT NULL DEFAULT '',
  ADD COLUMN invitation_header2 TEXT NOT NULL DEFAULT '',
  ADD COLUMN invitation_card_layout JSONB NOT NULL DEFAULT '{
    "qr": {"x": 53.5, "y": 19.5, "size": 30},
    "fields": {
      "header1":     {"font": "HELVETICA_OBLIQUE", "size": 10,   "y": 92},
      "header2":     {"font": "HELVETICA_OBLIQUE", "size": 8,    "y": 86},
      "coupleNames": {"font": "HELVETICA_BOLD",    "size": 17,   "y": 78},
      "dateLine":    {"font": "HELVETICA",         "size": 9.5,  "y": 70},
      "body":        {"font": "HELVETICA",         "size": 8.5,  "y": 62},
      "partyName":   {"font": "HELVETICA_OBLIQUE", "size": 10.5, "y": 50},
      "footer":      {"font": "HELVETICA",         "size": 8,    "y": 44.5},
      "hostLine":    {"font": "HELVETICA",         "size": 6.5,  "y": 40},
      "tokenLine":   {"font": "COURIER",           "size": 6,    "y": 36}
    }
  }'::jsonb;

UPDATE site_settings SET invitation_header1 = COALESCE(invitation_headline, '') WHERE singleton;

ALTER TABLE site_settings DROP COLUMN invitation_headline;

-- Re-point the seeded background: the old save-the-date default is being
-- superseded by card.jpg, so clear it (only if still pointing at the seeded
-- default, same pattern as V11) and let MediaSeedService install …a3 on next boot.
UPDATE site_settings SET invitation_image_id = NULL
  WHERE singleton AND invitation_image_id = '00000000-0000-0000-0000-0000000000a2';
