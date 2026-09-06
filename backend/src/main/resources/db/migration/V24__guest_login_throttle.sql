-- Brute-force protection for the guest verification answer. One row per party (the party is what
-- a guest logs in as), created lazily on the first login attempt for that party.
CREATE TABLE guest_login_throttle (
  party_id UUID PRIMARY KEY REFERENCES party(id),
  -- Rolling 1-minute attempt window: how many answers have been submitted since window_start.
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_count INT NOT NULL DEFAULT 0,
  -- Consecutive failures since the last success or admin unlock; drives both lock tiers.
  failed_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  locked_permanently BOOLEAN NOT NULL DEFAULT FALSE,
  last_failed_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
