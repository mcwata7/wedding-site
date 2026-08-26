-- The raw invitation token is retained (in addition to token_hash) so a printed card can be
-- regenerated or reprinted on demand without rotating a token that may already be in the post.
-- It is only factor one of two access factors -- the party's bcrypt verification answer is
-- factor two -- and it is printed in plaintext on the card itself, so hashing it at rest
-- defended against a threat model that doesn't apply here. See backend/SYSTEM_DESIGN.md for
-- the full rationale.
-- NEVER `SELECT * FROM invitation`, and never add "invitation" to InternalDataController.TABLES
-- -- both would leak this column into API responses or audit_record before/after snapshots.
ALTER TABLE invitation ADD COLUMN token TEXT;

ALTER TABLE site_settings
  ADD COLUMN invitation_image_id UUID REFERENCES media_asset(id),
  ADD COLUMN invitation_headline TEXT,
  ADD COLUMN invitation_body TEXT,
  ADD COLUMN invitation_footer TEXT;
