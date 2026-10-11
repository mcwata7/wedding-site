-- The wedding RSVP is an attribute of the guest, independent of events.
ALTER TABLE guest
  ADD COLUMN rsvp_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (rsvp_status IN ('ATTENDING','DECLINED','PENDING','WAITLISTED')),
  ADD COLUMN rsvp_note TEXT,
  ADD COLUMN rsvp_source TEXT CHECK (rsvp_source IN ('GUEST','PLANNER')),
  ADD COLUMN rsvp_updated_at TIMESTAMPTZ;

-- Ignore unanswered events. Preserve an unambiguous explicit response; conflicting
-- responses need a new wedding-wide answer. Keep every original row in history.
WITH responses AS (
  SELECT guest_id, count(DISTINCT status) FILTER (WHERE status <> 'PENDING') AS statuses,
    min(status) FILTER (WHERE status <> 'PENDING') AS status
  FROM rsvp GROUP BY guest_id
), latest AS (
  SELECT DISTINCT ON (guest_id) guest_id, note, source, updated_at
  FROM rsvp WHERE status <> 'PENDING'
  ORDER BY guest_id, updated_at DESC, id
)
UPDATE guest g SET
  rsvp_status = CASE WHEN r.statuses = 1 THEN r.status ELSE 'PENDING' END,
  rsvp_note = CASE WHEN r.statuses = 1 THEN l.note
    WHEN r.statuses > 1 THEN 'Previous event responses differ; please confirm attendance for the wedding.' END,
  rsvp_source = CASE WHEN r.statuses = 1 THEN l.source END,
  rsvp_updated_at = CASE WHEN r.statuses = 1 THEN l.updated_at END
FROM responses r LEFT JOIN latest l ON l.guest_id = r.guest_id
WHERE g.id = r.guest_id;

ALTER TABLE rsvp RENAME TO rsvp_event_history;
ALTER TABLE event_eligibility RENAME TO event_eligibility_history;
COMMENT ON TABLE rsvp_event_history IS 'Historical per-event responses retained by V29; no longer used for live RSVP collection.';
COMMENT ON TABLE event_eligibility_history IS 'Historical eligibility supporting the retained per-event RSVP foreign key.';
