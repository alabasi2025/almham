ALTER TABLE "collections"
  ADD COLUMN IF NOT EXISTS "collector_employee_id" uuid REFERENCES "employees"("id") ON DELETE set null;

CREATE INDEX IF NOT EXISTS "collections_collector_employee_idx"
  ON "collections" ("collector_employee_id");

CREATE TABLE IF NOT EXISTS "billing_collection_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL REFERENCES "stations"("id"),
  "billing_system_id" uuid NOT NULL REFERENCES "billing_systems"("id"),
  "cashbox_id" uuid NOT NULL REFERENCES "cashboxes"("id"),
  "entered_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "collection_date" timestamp NOT NULL,
  "total_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "billing_collection_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL REFERENCES "billing_collection_batches"("id") ON DELETE cascade,
  "collector_employee_id" uuid REFERENCES "employees"("id") ON DELETE set null,
  "collection_id" uuid REFERENCES "collections"("id") ON DELETE set null,
  "amount" numeric(18, 2) NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "billing_batches_station_date_idx"
  ON "billing_collection_batches" ("station_id", "collection_date");
CREATE INDEX IF NOT EXISTS "billing_batches_system_idx"
  ON "billing_collection_batches" ("billing_system_id");
CREATE INDEX IF NOT EXISTS "billing_batches_entered_by_idx"
  ON "billing_collection_batches" ("entered_by_user_id");
CREATE INDEX IF NOT EXISTS "billing_entries_batch_idx"
  ON "billing_collection_entries" ("batch_id");
CREATE INDEX IF NOT EXISTS "billing_entries_collector_idx"
  ON "billing_collection_entries" ("collector_employee_id");
CREATE INDEX IF NOT EXISTS "billing_entries_collection_idx"
  ON "billing_collection_entries" ("collection_id");
