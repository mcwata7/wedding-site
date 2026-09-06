-- Every party attends every event; event_eligibility is no longer a planner decision but a
-- maintained cross-product (see DataService.syncRsvps). Backfill what planners never granted.
INSERT INTO event_eligibility(event_id, party_id)
  SELECT e.id, p.id FROM event e CROSS JOIN party p
  ON CONFLICT DO NOTHING;

INSERT INTO rsvp(guest_id, event_id, party_id)
  SELECT g.id, ee.event_id, g.party_id
  FROM guest g JOIN event_eligibility ee ON ee.party_id = g.party_id
  WHERE g.active
  ON CONFLICT (guest_id, event_id) DO NOTHING;
