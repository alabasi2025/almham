DO $$ BEGIN
  CREATE TYPE "public"."billing_account_type" AS ENUM('collection', 'sales', 'settlement');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "billing_system_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "billing_system_id" uuid NOT NULL REFERENCES "billing_systems"("id") ON DELETE cascade,
  "name" varchar(128) NOT NULL,
  "code" varchar(64),
  "type" "billing_account_type" NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "billing_accounts_system_idx"
  ON "billing_system_accounts" ("billing_system_id");

CREATE INDEX IF NOT EXISTS "billing_accounts_type_idx"
  ON "billing_system_accounts" ("type");

ALTER TABLE "collections"
  ADD COLUMN IF NOT EXISTS "billing_account_id" uuid;

DO $$ BEGIN
  ALTER TABLE "collections"
    ADD CONSTRAINT "collections_billing_account_id_billing_system_accounts_id_fk"
    FOREIGN KEY ("billing_account_id") REFERENCES "billing_system_accounts"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "collections_billing_account_idx"
  ON "collections" ("billing_account_id");

ALTER TABLE "billing_collection_batches"
  ADD COLUMN IF NOT EXISTS "billing_account_id" uuid;

DO $$ BEGIN
  ALTER TABLE "billing_collection_batches"
    ADD CONSTRAINT "billing_collection_batches_billing_account_id_billing_system_accounts_id_fk"
    FOREIGN KEY ("billing_account_id") REFERENCES "billing_system_accounts"("id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "billing_batches_account_idx"
  ON "billing_collection_batches" ("billing_account_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "billing_collection_batches" WHERE "billing_account_id" IS NULL
  ) THEN
    ALTER TABLE "billing_collection_batches" ALTER COLUMN "billing_account_id" SET NOT NULL;
  END IF;
END $$;
