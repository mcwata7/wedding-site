-- An rsvp row only makes sense while its party is invited to the event (event_eligibility)
-- and the guest is still active. Neither was previously enforced: rsvp rows could outlive
-- eligibility (no FK) or an archived guest (soft-delete never cleaned rsvp up). This adds
-- created_at (for waitlist FIFO ordering, which rsvp could not express before) and a composite
-- FK to event_eligibility so removing a party's eligibility cascades its rsvp rows away.
ALTER TABLE rsvp ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Clean up existing drift before the FK can be added.
DELETE FROM rsvp r
  USING guest g
  WHERE g.id = r.guest_id
    AND (
      NOT g.active
      OR NOT EXISTS (
        SELECT 1 FROM event_eligibility ee WHERE ee.event_id = r.event_id AND ee.party_id = g.party_id
      )
    );

ALTER TABLE rsvp ADD COLUMN party_id UUID;
UPDATE rsvp r SET party_id = g.party_id FROM guest g WHERE g.id = r.guest_id;
ALTER TABLE rsvp ALTER COLUMN party_id SET NOT NULL;
ALTER TABLE rsvp ADD CONSTRAINT rsvp_eligibility_fk
  FOREIGN KEY (event_id, party_id) REFERENCES event_eligibility(event_id, party_id) ON DELETE CASCADE;

CREATE INDEX rsvp_party_idx ON rsvp(party_id);
