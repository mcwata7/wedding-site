CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE planner_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('ADMIN','PLANNER')),
  active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE party (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), display_name TEXT NOT NULL,
  contact_email TEXT, contact_phone TEXT, verification_question TEXT NOT NULL,
  verification_answer_hash TEXT NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE guest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), party_id UUID NOT NULL REFERENCES party(id),
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, relationship_group TEXT,
  email TEXT, phone TEXT, dietary_requirements TEXT, accessibility_needs TEXT,
  travel_origin TEXT, flight_number TEXT, planner_notes TEXT,
  is_additional_guest BOOLEAN NOT NULL DEFAULT FALSE, active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE invitation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), party_id UUID NOT NULL UNIQUE REFERENCES party(id),
  token_hash TEXT NOT NULL UNIQUE, token_expires_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','SENT','VIEWED','RESPONDED','CLOSED')),
  sent_at TIMESTAMPTZ, viewed_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE invitation_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), invitation_id UUID NOT NULL REFERENCES invitation(id),
  kind TEXT NOT NULL CHECK (kind IN ('DELIVERY','REMINDER')), occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), note TEXT,
  recorded_by UUID REFERENCES planner_user(id)
);
CREATE TABLE venue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, address TEXT, contact_information TEXT,
  pricing NUMERIC(14,2), capacity INTEGER, food_score NUMERIC(3,1), view_score NUMERIC(3,1), notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), venue_id UUID REFERENCES venue(id), name TEXT NOT NULL,
  description TEXT, starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ, dress_code TEXT, capacity INTEGER,
  rsvp_deadline TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE event_eligibility (
  event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES party(id) ON DELETE CASCADE, PRIMARY KEY (event_id, party_id)
);
CREATE TABLE rsvp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), guest_id UUID NOT NULL REFERENCES guest(id), event_id UUID NOT NULL REFERENCES event(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('ATTENDING','DECLINED','PENDING','WAITLISTED')),
  note TEXT, source TEXT NOT NULL DEFAULT 'GUEST' CHECK (source IN ('GUEST','PLANNER')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(guest_id,event_id)
);
CREATE TABLE accommodation_property (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, address TEXT, contact_information TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE accommodation_room (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), property_id UUID NOT NULL REFERENCES accommodation_property(id),
  room_number TEXT NOT NULL, room_type TEXT, capacity INTEGER NOT NULL CHECK (capacity > 0), UNIQUE(property_id, room_number)
);
CREATE TABLE accommodation_assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_id UUID NOT NULL REFERENCES accommodation_room(id),
  party_id UUID REFERENCES party(id), guest_id UUID REFERENCES guest(id), check_in DATE NOT NULL, check_out DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','CANCELLED')), coverage_notes TEXT,
  override_capacity BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (party_id IS NOT NULL OR guest_id IS NOT NULL), CHECK (check_out > check_in)
);
CREATE TABLE accommodation_change_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id UUID NOT NULL REFERENCES accommodation_assignment(id),
  party_id UUID NOT NULL REFERENCES party(id), request_note TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','RESOLVED','DECLINED')), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE budget_category (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE budget_contributor (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE budget_line_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), category_id UUID NOT NULL REFERENCES budget_category(id), description TEXT NOT NULL,
  currency CHAR(3) NOT NULL, planned_amount NUMERIC(14,2) NOT NULL DEFAULT 0, actual_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID','PARTIAL','PAID')),
  due_date DATE, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE budget_line_item_contributor (line_item_id UUID NOT NULL REFERENCES budget_line_item(id) ON DELETE CASCADE, contributor_id UUID NOT NULL REFERENCES budget_contributor(id), amount NUMERIC(14,2), PRIMARY KEY(line_item_id, contributor_id));
CREATE TABLE fx_rate_snapshot (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), base_currency CHAR(3) NOT NULL, quote_currency CHAR(3) NOT NULL, rate NUMERIC(20,10) NOT NULL, rate_date DATE NOT NULL, source TEXT NOT NULL, fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(base_currency,quote_currency,rate_date,source));
CREATE TABLE audit_record (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_id UUID REFERENCES planner_user(id), action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id UUID NOT NULL, before_value JSONB, after_value JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE INDEX guest_party_idx ON guest(party_id); CREATE INDEX rsvp_event_idx ON rsvp(event_id); CREATE INDEX assignment_room_dates_idx ON accommodation_assignment(room_id, check_in, check_out); CREATE INDEX audit_entity_idx ON audit_record(entity_type, entity_id);
