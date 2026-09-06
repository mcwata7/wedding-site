-- Merges the separate hostLine/tokenLine fields (host domain and bare token, printed as two lines)
-- into one combined inviteUrl field, now that the token itself is short enough to read as one
-- line -- see InvitationCardRenderer.drawCard, which builds `host + "/i/" + token` as a single
-- string. Any per-field font/size/color a planner had already customized on hostLine/tokenLine is
-- not carried over -- two fields becoming one can't be meaningfully merged -- but this is early
-- enough in the layout feature's life (added this same migration sequence, V12/V14) that no real
-- customization risk exists yet.
UPDATE site_settings SET invitation_card_layout =
  jsonb_set(
    (invitation_card_layout #- '{fields,hostLine}') #- '{fields,tokenLine}',
    '{fields,inviteUrl}',
    '{"font": "COURIER", "size": 6, "y": 38, "color": "#737373"}'::jsonb,
    true)
WHERE singleton;

-- V12's column-level DEFAULT on invitation_card_layout was already stale after V14 (missing
-- "color" on every field) -- unreachable today since site_settings' singleton row is only ever
-- created once (V3), but if it were ever hit, CardLayout.validate() would 422 on the null color.
-- Bring the column default fully up to date (color + the new inviteUrl field) while this migration
-- is already restructuring this column, so it isn't left doubly stale.
ALTER TABLE site_settings ALTER COLUMN invitation_card_layout SET DEFAULT '{
  "qr": {"x": 53.5, "y": 19.5, "size": 30},
  "fields": {
    "header1":     {"font": "HELVETICA_OBLIQUE", "size": 10,   "y": 92,   "color": "#000000"},
    "header2":     {"font": "HELVETICA_OBLIQUE", "size": 8,    "y": 86,   "color": "#000000"},
    "coupleNames": {"font": "HELVETICA_BOLD",    "size": 17,   "y": 78,   "color": "#000000"},
    "dateLine":    {"font": "HELVETICA",         "size": 9.5,  "y": 70,   "color": "#000000"},
    "body":        {"font": "HELVETICA",         "size": 8.5,  "y": 62,   "color": "#000000"},
    "partyName":   {"font": "HELVETICA_OBLIQUE", "size": 10.5, "y": 50,   "color": "#000000"},
    "footer":      {"font": "HELVETICA",         "size": 8,    "y": 44.5, "color": "#000000"},
    "inviteUrl":   {"font": "COURIER",           "size": 6,    "y": 38,   "color": "#737373"}
  }
}'::jsonb;
