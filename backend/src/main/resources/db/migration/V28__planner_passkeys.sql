CREATE TABLE planner_passkey (
  credential_id TEXT PRIMARY KEY,
  planner_id UUID NOT NULL REFERENCES planner_user(id),
  rp_id TEXT NOT NULL,
  public_key_cose TEXT NOT NULL,
  signature_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX planner_passkey_owner ON planner_passkey(planner_id,rp_id);

-- Shared across API restarts/instances. Finishing a ceremony atomically consumes its challenge.
CREATE TABLE planner_passkey_challenge (
  id UUID PRIMARY KEY,
  planner_id UUID REFERENCES planner_user(id),
  kind TEXT NOT NULL CHECK (kind IN ('ENROLLMENT','REGISTER','LOGIN')),
  origin TEXT,
  request_json TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX planner_passkey_challenge_expiry ON planner_passkey_challenge(expires_at);
