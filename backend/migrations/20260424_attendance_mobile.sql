DO $$ BEGIN
  CREATE TYPE "public"."work_session_status" AS ENUM('open', 'closed', 'abandoned');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."attendance_event_type" AS ENUM('check_in', 'check_out');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."attendance_source" AS ENUM('mobile', 'zkteco', 'manager');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."attendance_event_status" AS ENUM('accepted', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "station_attendance_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL UNIQUE REFERENCES "stations"("id") ON DELETE cascade,
  "radius_meters" integer DEFAULT 100 NOT NULL,
  "tracking_interval_seconds" integer DEFAULT 300 NOT NULL,
  "require_gps" boolean DEFAULT true NOT NULL,
  "require_biometric" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "work_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_session_id" varchar(128) NOT NULL UNIQUE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE cascade,
  "station_id" uuid NOT NULL REFERENCES "stations"("id"),
  "status" "work_session_status" DEFAULT 'open' NOT NULL,
  "started_at" timestamp NOT NULL,
  "ended_at" timestamp,
  "check_in_latitude" numeric(10, 7),
  "check_in_longitude" numeric(10, 7),
  "check_in_accuracy_meters" integer,
  "check_in_distance_meters" integer,
  "check_out_latitude" numeric(10, 7),
  "check_out_longitude" numeric(10, 7),
  "check_out_accuracy_meters" integer,
  "check_out_distance_meters" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "attendance_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_event_id" varchar(128) NOT NULL UNIQUE,
  "session_id" uuid REFERENCES "work_sessions"("id") ON DELETE set null,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE cascade,
  "station_id" uuid NOT NULL REFERENCES "stations"("id"),
  "type" "attendance_event_type" NOT NULL,
  "source" "attendance_source" DEFAULT 'mobile' NOT NULL,
  "status" "attendance_event_status" DEFAULT 'accepted' NOT NULL,
  "recorded_at" timestamp NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL,
  "latitude" numeric(10, 7),
  "longitude" numeric(10, 7),
  "accuracy_meters" integer,
  "distance_meters" integer,
  "rejection_reason" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "location_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_point_id" varchar(128) NOT NULL UNIQUE,
  "session_id" uuid REFERENCES "work_sessions"("id") ON DELETE cascade,
  "client_session_id" varchar(128) NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE cascade,
  "station_id" uuid NOT NULL REFERENCES "stations"("id"),
  "recorded_at" timestamp NOT NULL,
  "received_at" timestamp DEFAULT now() NOT NULL,
  "latitude" numeric(10, 7) NOT NULL,
  "longitude" numeric(10, 7) NOT NULL,
  "accuracy_meters" integer,
  "speed_meters_per_second" numeric(10, 3),
  "heading_degrees" numeric(10, 3),
  "battery_level" numeric(5, 4),
  "is_offline" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "attendance_settings_station_idx" ON "station_attendance_settings" ("station_id");
CREATE INDEX IF NOT EXISTS "work_sessions_client_session_idx" ON "work_sessions" ("client_session_id");
CREATE INDEX IF NOT EXISTS "work_sessions_employee_status_idx" ON "work_sessions" ("employee_id", "status");
CREATE INDEX IF NOT EXISTS "work_sessions_station_status_idx" ON "work_sessions" ("station_id", "status");
CREATE INDEX IF NOT EXISTS "work_sessions_started_at_idx" ON "work_sessions" ("started_at");
CREATE INDEX IF NOT EXISTS "attendance_events_client_event_idx" ON "attendance_events" ("client_event_id");
CREATE INDEX IF NOT EXISTS "attendance_events_employee_recorded_idx" ON "attendance_events" ("employee_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "attendance_events_station_recorded_idx" ON "attendance_events" ("station_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "location_points_client_point_idx" ON "location_points" ("client_point_id");
CREATE INDEX IF NOT EXISTS "location_points_session_recorded_idx" ON "location_points" ("session_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "location_points_employee_recorded_idx" ON "location_points" ("employee_id", "recorded_at");
