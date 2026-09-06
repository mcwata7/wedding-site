-- accommodation_property/accommodation_room are folded into venue/venue_room: a wedding
-- venue in this app is now the hotel itself, so a lodging place and its rooms no longer need
-- two separate entities. venue_room already generalized "a room" to "a room type with N
-- available"; a specific numbered room is just the special case where room_number is set and
-- max_available isn't tracked. See backend/SYSTEM_DESIGN.md §12 for the full rationale.
ALTER TABLE venue_room
  ADD COLUMN room_number TEXT,
  ALTER COLUMN room_type DROP NOT NULL,
  ADD CONSTRAINT venue_room_venue_id_room_number_key UNIQUE (venue_id, room_number),
  ADD CONSTRAINT venue_room_capacity_check CHECK (capacity IS NULL OR capacity > 0);

-- Same-UUID copy: accommodation_assignment.room_id and guest.room_assignment_id values stay
-- valid without rewriting a single row -- only the FK target changes below.
INSERT INTO venue (id, name, address, contact_information, notes, archived, created_at)
  SELECT id, name, address, contact_information, notes, archived, created_at FROM accommodation_property;
INSERT INTO venue_room (id, venue_id, room_type, room_number, capacity, archived, created_at, updated_at)
  SELECT id, property_id, room_type, room_number, capacity, archived, now(), now() FROM accommodation_room;

ALTER TABLE accommodation_assignment DROP CONSTRAINT accommodation_assignment_room_id_fkey;
ALTER TABLE accommodation_assignment ADD CONSTRAINT accommodation_assignment_room_id_fkey FOREIGN KEY (room_id) REFERENCES venue_room(id);
ALTER TABLE guest DROP CONSTRAINT guest_room_assignment_id_fkey;
ALTER TABLE guest ADD CONSTRAINT guest_room_assignment_id_fkey FOREIGN KEY (room_assignment_id) REFERENCES venue_room(id);

DROP TABLE accommodation_room;
DROP TABLE accommodation_property;
