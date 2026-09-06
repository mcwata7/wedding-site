-- Adds a "color" (hex string) to every field in site_settings.invitation_card_layout, matching
-- the visual defaults the renderer previously hardcoded (black text, muted gray for the
-- host/token credential lines) -- see InvitationCardRenderer.DEFAULT_LAYOUT, which this mirrors.
-- jsonb_set with create_missing=true only adds the new key; any planner customization already
-- saved to the other keys in each field object (font/size/y) is left untouched.
UPDATE site_settings SET invitation_card_layout =
  jsonb_set(
  jsonb_set(
  jsonb_set(
  jsonb_set(
  jsonb_set(
  jsonb_set(
  jsonb_set(
  jsonb_set(
  jsonb_set(invitation_card_layout, '{fields,header1,color}', '"#000000"', true),
    '{fields,header2,color}', '"#000000"', true),
    '{fields,coupleNames,color}', '"#000000"', true),
    '{fields,dateLine,color}', '"#000000"', true),
    '{fields,body,color}', '"#000000"', true),
    '{fields,partyName,color}', '"#000000"', true),
    '{fields,footer,color}', '"#000000"', true),
    '{fields,hostLine,color}', '"#737373"', true),
    '{fields,tokenLine,color}', '"#737373"', true)
WHERE singleton;
