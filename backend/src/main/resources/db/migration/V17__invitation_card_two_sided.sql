-- The invitation card is now two-sided: a pure-image front and a back carrying only the QR, the
-- invite URL, and the party's display name. Every free-text field is gone (header1/header2/
-- coupleNames/dateLine/body/footer), so the four TEXT columns that fed them go with it, the single
-- background image becomes a front/back pair (the existing image becomes the front -- it was
-- already all-artwork), and the layout jsonb is replaced wholesale with the new three-element
-- shape. Supersedes the 2026-08-30 "Per-field text color" decision-log entry's rejection of a
-- planner-editable QR color -- see docs/DECISIONS.md for the new entry.
ALTER TABLE site_settings
  DROP COLUMN invitation_header1,
  DROP COLUMN invitation_header2,
  DROP COLUMN invitation_body,
  DROP COLUMN invitation_footer;

ALTER TABLE site_settings RENAME COLUMN invitation_image_id TO invitation_front_image_id;

ALTER TABLE site_settings
  ADD COLUMN invitation_back_image_id UUID REFERENCES media_asset(id),
  ADD COLUMN invitation_orientation TEXT NOT NULL DEFAULT 'PORTRAIT'
    CHECK (invitation_orientation IN ('PORTRAIT','LANDSCAPE'));

UPDATE site_settings SET invitation_card_layout = '{
  "qr":         {"x": 52.5, "y": 74,  "size": 40, "color": "#000000"},
  "inviteUrl":  {"x": 52.5, "y": 48,  "size": 6,  "color": "#737373"},
  "guestNames": {"x": 52.5, "y": 108, "size": 11, "color": "#000000"}
}'::jsonb WHERE singleton;

-- V12 set this column DEFAULT; V15 already had to re-fix it once because V14 left it stale. Keep
-- it in lockstep with the UPDATE above and with InvitationCardRenderer.DEFAULT_LAYOUT.
ALTER TABLE site_settings ALTER COLUMN invitation_card_layout SET DEFAULT '{
  "qr":         {"x": 52.5, "y": 74,  "size": 40, "color": "#000000"},
  "inviteUrl":  {"x": 52.5, "y": 48,  "size": 6,  "color": "#737373"},
  "guestNames": {"x": 52.5, "y": 108, "size": 11, "color": "#000000"}
}'::jsonb;
