ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "public_key_jwk" text;
ALTER TABLE "group_messages" ADD COLUMN IF NOT EXISTS "image_data_url" text;
