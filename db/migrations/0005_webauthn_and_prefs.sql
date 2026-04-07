ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "message_edit_window_minutes" integer DEFAULT 30 NOT NULL;

CREATE TABLE IF NOT EXISTS "webauthn_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
	"email" text,
	"challenge" text NOT NULL,
	"kind" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS "webauthn_challenges_expires_idx" ON "webauthn_challenges" ("expires_at");

CREATE TABLE IF NOT EXISTS "webauthn_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"credential_id" text NOT NULL UNIQUE,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "webauthn_credentials_user_idx" ON "webauthn_credentials" ("user_id");

CREATE TABLE IF NOT EXISTS "webauthn_login_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"expires_at" timestamp with time zone NOT NULL
);

ALTER TABLE "group_messages" ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;
