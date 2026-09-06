-- Venue metadata for comparing candidate venues around Kathmandu.
ALTER TABLE venue
  ADD COLUMN location TEXT,
  ADD COLUMN distance_from_ktm_km NUMERIC(6,1),
  ADD COLUMN transportation_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN room_block_min INTEGER,
  ADD COLUMN room_block_max INTEGER;

-- Venue cost is two unrelated shapes, so it is two tables rather than one table
-- with a kind discriminator: a room row is priced per night in two tiers and has
-- an occupancy and a count, a fee row is a single amount for a named service.
-- Rates are NPR; capacity is people per room, max_available is how many such rooms.
CREATE TABLE venue_room (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), venue_id UUID NOT NULL REFERENCES venue(id),
  room_type TEXT NOT NULL, capacity INTEGER, max_available INTEGER,
  nepali_rate NUMERIC(14,2), foreigner_rate NUMERIC(14,2), notes TEXT,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE venue_fee (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), venue_id UUID NOT NULL REFERENCES venue(id),
  fee_type TEXT NOT NULL CHECK (fee_type IN
    ('SANGEET_DAY_CATERING','WEDDING_LUNCH_CATERING','WEDDING_DINNER_CATERING','CORKAGE')),
  amount NUMERIC(14,2), notes TEXT,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX venue_room_venue_idx ON venue_room(venue_id);
CREATE INDEX venue_fee_venue_idx ON venue_fee(venue_id);

-- Guest list-building metadata. planner_notes already covers "notes".
ALTER TABLE guest
  ADD COLUMN wedding_side TEXT CHECK (wedding_side IN ('BRIDE','GROOM')),
  ADD COLUMN attendance_probability TEXT CHECK (attendance_probability IN
    ('CERTAIN','VERY_LIKELY','LIKELY','MAYBE','UNLIKELY')),
  ADD COLUMN is_wedding_party BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN passport TEXT CHECK (passport IN ('NEPALI','INDIAN','OTHER')),
  ADD COLUMN is_ktm_resident BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_child BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN room_assignment_id UUID REFERENCES accommodation_room(id),
  ADD COLUMN invite_round INTEGER;

-- relationship_group was free text; normalise before constraining so the CHECK
-- can be added without failing on existing rows.
UPDATE guest SET relationship_group = upper(trim(relationship_group)) WHERE relationship_group IS NOT NULL;
UPDATE guest SET relationship_group = NULL WHERE relationship_group = '';
UPDATE guest SET relationship_group = 'OTHER'
  WHERE relationship_group IS NOT NULL AND relationship_group NOT IN ('FAMILY','RELATIVE','FRIEND','OTHER');
ALTER TABLE guest ADD CONSTRAINT guest_relationship_group_check
  CHECK (relationship_group IS NULL OR relationship_group IN ('FAMILY','RELATIVE','FRIEND','OTHER'));
