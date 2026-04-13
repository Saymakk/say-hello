-- Full migration to phone-as-id model.
-- NOTE: this migration resets user-linked server data and recreates schema
-- with text user IDs (digits-only phone numbers).

DROP TABLE IF EXISTS webauthn_login_codes CASCADE;
DROP TABLE IF EXISTS webauthn_credentials CASCADE;
DROP TABLE IF EXISTS webauthn_challenges CASCADE;
DROP TABLE IF EXISTS dm_requests CASCADE;
DROP TABLE IF EXISTS dm_allowed_pairs CASCADE;
DROP TABLE IF EXISTS user_blocks CASCADE;
DROP TABLE IF EXISTS signal_packets CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS group_messages CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id text PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text,
  short_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  public_key_jwk text,
  message_edit_window_minutes integer NOT NULL DEFAULT 30
);
CREATE INDEX users_short_code_idx ON users(short_code);

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  image_data_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);
CREATE INDEX group_messages_group_created_idx ON group_messages(group_id, created_at);

CREATE TABLE group_members (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE signal_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id text REFERENCES users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  payload text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signal_to_user_created_idx ON signal_packets(to_user_id, created_at);
CREATE INDEX signal_group_created_idx ON signal_packets(group_id, created_at);

CREATE TABLE user_blocks (
  blocker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE dm_allowed_pairs (
  user_a text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b)
);

CREATE TABLE dm_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  first_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX dm_requests_from_to_unique ON dm_requests(from_user_id, to_user_id);
CREATE INDEX dm_requests_to_status_idx ON dm_requests(to_user_id, status);
CREATE INDEX dm_requests_from_status_idx ON dm_requests(from_user_id, status);

CREATE TABLE webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  phone text,
  challenge text NOT NULL,
  kind text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX webauthn_challenges_expires_idx ON webauthn_challenges(expires_at);

CREATE TABLE webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webauthn_credentials_user_idx ON webauthn_credentials(user_id);

CREATE TABLE webauthn_login_codes (
  code text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
