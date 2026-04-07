CREATE TABLE IF NOT EXISTS "user_blocks" (
  "blocker_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "blocked_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("blocker_id", "blocked_id"),
  CONSTRAINT "chk_block_self" CHECK ("blocker_id" <> "blocked_id")
);

CREATE TABLE IF NOT EXISTS "dm_allowed_pairs" (
  "user_a" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "user_b" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_a", "user_b"),
  CONSTRAINT "chk_pair_order" CHECK ("user_a"::text < "user_b"::text)
);

CREATE TABLE IF NOT EXISTS "dm_requests" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "from_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "to_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "first_message_preview" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "chk_dm_req_self" CHECK ("from_user_id" <> "to_user_id"),
  CONSTRAINT "dm_requests_status_chk" CHECK ("status" IN ('pending', 'accepted', 'declined')),
  UNIQUE ("from_user_id", "to_user_id")
);

CREATE INDEX IF NOT EXISTS "dm_requests_to_status_idx" ON "dm_requests" ("to_user_id", "status");
CREATE INDEX IF NOT EXISTS "dm_requests_from_status_idx" ON "dm_requests" ("from_user_id", "status");
