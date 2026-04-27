CREATE TYPE "public"."billing_adjustment_type" AS ENUM('accrual', 'reading_error', 'activity_error', 'subscription_fee', 'payment_reverse', 'data_correction', 'credit_add', 'credit_deduct');--> statement-breakpoint
CREATE TYPE "public"."billing_customer_state" AS ENUM('active', 'suspended', 'cancelled', 'pending');--> statement-breakpoint
CREATE TYPE "public"."billing_debenture_state" AS ENUM('active', 'used', 'lost', 'damaged', 'voided');--> statement-breakpoint
CREATE TYPE "public"."billing_ecas_db" AS ENUM('Ecas2673', 'Ecas2668');--> statement-breakpoint
CREATE TYPE "public"."billing_meter_state" AS ENUM('active', 'replaced', 'removed', 'faulty');--> statement-breakpoint
CREATE TYPE "public"."billing_payment_source" AS ENUM('counter', 'mobile', 'wallet', 'bank', 'manual', 'import');--> statement-breakpoint
CREATE TYPE "public"."billing_period_part" AS ENUM('f1', 'f2', 'f3');--> statement-breakpoint
CREATE TYPE "public"."billing_reading_source" AS ENUM('manual', 'mobile', 'estimated', 'import');--> statement-breakpoint
CREATE TABLE "billing_activity_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_address_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_id" bigint,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"period_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"type" "billing_adjustment_type" NOT NULL,
	"adjustment_value" numeric(18, 2) NOT NULL,
	"total_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"official_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"exempt_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"error_value" numeric(18, 2),
	"correct_value" numeric(18, 2),
	"error_date" date,
	"reason" text,
	"notes" text,
	"applied_at" timestamp,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_dt_id" bigint NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"period_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"square_id" uuid,
	"previous_read" numeric(14, 2),
	"current_read" numeric(14, 2),
	"month_consume" integer DEFAULT 0 NOT NULL,
	"consume_value" numeric(14, 2),
	"daily_const_consume" numeric(14, 2),
	"consume_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"consume_added_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"consume_official_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"consume_exempt_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"last_balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"last_arrears" numeric(18, 2) DEFAULT '0' NOT NULL,
	"arrears" numeric(18, 2) DEFAULT '0' NOT NULL,
	"payment_count" integer DEFAULT 0 NOT NULL,
	"payment_sum_money" numeric(18, 2) DEFAULT '0' NOT NULL,
	"count_zero_read" integer DEFAULT 0 NOT NULL,
	"count_zero_payment" integer DEFAULT 0 NOT NULL,
	"reading_source" "billing_reading_source" DEFAULT 'import' NOT NULL,
	"reading_employee_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"area_id" uuid,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_cashier_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"cashier_id" uuid,
	"book_no" varchar(64) NOT NULL,
	"from_serial" integer,
	"to_serial" integer,
	"issued_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_cashiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"station_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(64),
	"is_electronic" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_customer_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"ecas_id" integer,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"field" varchar(128),
	"old_value" text,
	"new_value" text,
	"updated_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"ecas_ref_id" integer,
	"station_id" uuid NOT NULL,
	"square_id" uuid,
	"register_id" uuid,
	"activity_type_id" uuid,
	"address_type_id" uuid,
	"phase_id" uuid,
	"subscriber_code" varchar(64) NOT NULL,
	"name" varchar(500) NOT NULL,
	"address" varchar(1000),
	"neighbor" varchar(500),
	"count_no" varchar(64),
	"ad_no" varchar(64),
	"ad_field" varchar(255),
	"ad_tor" varchar(255),
	"phone" varchar(64),
	"begin_service_date" date,
	"last_read" numeric(14, 2),
	"current_read" numeric(14, 2),
	"last_balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"last_arrears" numeric(18, 2) DEFAULT '0' NOT NULL,
	"current_balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"state" "billing_customer_state" DEFAULT 'active' NOT NULL,
	"record_state" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_flashlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"table_name" varchar(128) NOT NULL,
	"rows_read" integer DEFAULT 0 NOT NULL,
	"rows_inserted" integer DEFAULT 0 NOT NULL,
	"rows_updated" integer DEFAULT 0 NOT NULL,
	"rows_skipped" integer DEFAULT 0 NOT NULL,
	"rows_failed" integer DEFAULT 0 NOT NULL,
	"error_log" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "billing_manual_debentures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"book_id" uuid,
	"serial_no" integer NOT NULL,
	"state" "billing_debenture_state" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_meter_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"old_meter_no" varchar(64),
	"old_meter_last_read" numeric(14, 2),
	"new_meter_no" varchar(64),
	"new_meter_start_read" numeric(14, 2),
	"reason" text,
	"changed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_months" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"name" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_payment_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_id" bigint NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"period_id" uuid,
	"cashier_id" uuid,
	"payments_count" integer DEFAULT 0 NOT NULL,
	"total_money" numeric(18, 2) DEFAULT '0' NOT NULL,
	"started_at" timestamp,
	"closed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_id" bigint NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"period_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"cashier_id" uuid,
	"payment_group_id" uuid,
	"debenture_id" uuid,
	"amount" numeric(18, 2) NOT NULL,
	"source" "billing_payment_source" DEFAULT 'import' NOT NULL,
	"receipt_no" varchar(128),
	"wallet_provider" varchar(64),
	"wallet_ref" varchar(128),
	"paid_at" timestamp NOT NULL,
	"reversed_at" timestamp,
	"reversed_by" uuid,
	"reversal_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"bills_count" integer DEFAULT 0 NOT NULL,
	"total_kwh" bigint DEFAULT 0 NOT NULL,
	"total_sales" numeric(20, 2) DEFAULT '0' NOT NULL,
	"payments_count" integer DEFAULT 0 NOT NULL,
	"total_collected" numeric(20, 2) DEFAULT '0' NOT NULL,
	"total_adjustments" numeric(20, 2) DEFAULT '0' NOT NULL,
	"total_arrears" numeric(20, 2) DEFAULT '0' NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_id" bigint NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"part" "billing_period_part" NOT NULL,
	"name" varchar(128) NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"is_computed" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"allow_pay_for_next_period" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"name" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_registers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"branch_id" uuid,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_screens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" integer NOT NULL,
	"name" varchar(500) NOT NULL,
	"menu_key" varchar(64),
	"menu_index" integer,
	"rank_id" integer DEFAULT 1 NOT NULL,
	"route_path" varchar(255),
	"is_implemented" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_screens_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "billing_squares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"register_id" uuid,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"name" varchar(500) NOT NULL,
	"detected_station" varchar(32),
	"needs_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"company_name" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_stations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "billing_tariff_slices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ecas_id" integer NOT NULL,
	"ecas_db" "billing_ecas_db" NOT NULL,
	"activity_type_id" uuid,
	"from_kwh" integer NOT NULL,
	"to_kwh" integer,
	"price_per_kwh" numeric(12, 2) NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_years_year_unique" UNIQUE("year")
);
--> statement-breakpoint
ALTER TABLE "billing_adjustments" ADD CONSTRAINT "billing_adjustments_period_id_billing_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_adjustments" ADD CONSTRAINT "billing_adjustments_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_adjustments" ADD CONSTRAINT "billing_adjustments_station_id_billing_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."billing_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_areas" ADD CONSTRAINT "billing_areas_station_id_billing_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."billing_stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_bills" ADD CONSTRAINT "billing_bills_period_id_billing_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_bills" ADD CONSTRAINT "billing_bills_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_bills" ADD CONSTRAINT "billing_bills_station_id_billing_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."billing_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_bills" ADD CONSTRAINT "billing_bills_square_id_billing_squares_id_fk" FOREIGN KEY ("square_id") REFERENCES "public"."billing_squares"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_branches" ADD CONSTRAINT "billing_branches_station_id_billing_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."billing_stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_branches" ADD CONSTRAINT "billing_branches_area_id_billing_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."billing_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_cashier_books" ADD CONSTRAINT "billing_cashier_books_cashier_id_billing_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."billing_cashiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_cashiers" ADD CONSTRAINT "billing_cashiers_station_id_billing_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."billing_stations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customer_updates" ADD CONSTRAINT "billing_customer_updates_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_station_id_billing_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."billing_stations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_square_id_billing_squares_id_fk" FOREIGN KEY ("square_id") REFERENCES "public"."billing_squares"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_register_id_billing_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."billing_registers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_activity_type_id_billing_activity_types_id_fk" FOREIGN KEY ("activity_type_id") REFERENCES "public"."billing_activity_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_address_type_id_billing_address_types_id_fk" FOREIGN KEY ("address_type_id") REFERENCES "public"."billing_address_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_phase_id_billing_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."billing_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_flashlights" ADD CONSTRAINT "billing_flashlights_station_id_billing_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."billing_stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_manual_debentures" ADD CONSTRAINT "billing_manual_debentures_book_id_billing_cashier_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."billing_cashier_books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_meter_changes" ADD CONSTRAINT "billing_meter_changes_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payment_groups" ADD CONSTRAINT "billing_payment_groups_period_id_billing_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payment_groups" ADD CONSTRAINT "billing_payment_groups_cashier_id_billing_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."billing_cashiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_period_id_billing_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_station_id_billing_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."billing_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_cashier_id_billing_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."billing_cashiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_payment_group_id_billing_payment_groups_id_fk" FOREIGN KEY ("payment_group_id") REFERENCES "public"."billing_payment_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_debenture_id_billing_manual_debentures_id_fk" FOREIGN KEY ("debenture_id") REFERENCES "public"."billing_manual_debentures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_summary" ADD CONSTRAINT "billing_period_summary_period_id_billing_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period_summary" ADD CONSTRAINT "billing_period_summary_station_id_billing_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."billing_stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_registers" ADD CONSTRAINT "billing_registers_station_id_billing_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."billing_stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_registers" ADD CONSTRAINT "billing_registers_branch_id_billing_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."billing_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_squares" ADD CONSTRAINT "billing_squares_station_id_billing_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."billing_stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_squares" ADD CONSTRAINT "billing_squares_register_id_billing_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."billing_registers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_tariff_slices" ADD CONSTRAINT "billing_tariff_slices_activity_type_id_billing_activity_types_id_fk" FOREIGN KEY ("activity_type_id") REFERENCES "public"."billing_activity_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bact_ecas_unq" ON "billing_activity_types" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE UNIQUE INDEX "badt_ecas_unq" ON "billing_address_types" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "badj_period_idx" ON "billing_adjustments" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "badj_customer_idx" ON "billing_adjustments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "badj_type_idx" ON "billing_adjustments" USING btree ("type");--> statement-breakpoint
CREATE INDEX "badj_station_idx" ON "billing_adjustments" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bar_ecas_unq" ON "billing_areas" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "bar_station_idx" ON "billing_areas" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bb_ecas_unq" ON "billing_bills" USING btree ("ecas_db","ecas_dt_id","customer_id");--> statement-breakpoint
CREATE INDEX "bb_period_idx" ON "billing_bills" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "bb_customer_idx" ON "billing_bills" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "bb_station_idx" ON "billing_bills" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bbr_ecas_unq" ON "billing_branches" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "bbr_station_idx" ON "billing_branches" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bcb_ecas_unq" ON "billing_cashier_books" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "bcb_cashier_idx" ON "billing_cashier_books" USING btree ("cashier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bcsh_ecas_unq" ON "billing_cashiers" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "bcsh_station_idx" ON "billing_cashiers" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "bcsh_name_idx" ON "billing_cashiers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "bcu_customer_idx" ON "billing_customer_updates" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bc_ecas_unq" ON "billing_customers" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "bc_station_idx" ON "billing_customers" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "bc_square_idx" ON "billing_customers" USING btree ("square_id");--> statement-breakpoint
CREATE INDEX "bc_code_idx" ON "billing_customers" USING btree ("subscriber_code");--> statement-breakpoint
CREATE INDEX "bc_name_idx" ON "billing_customers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "bfl_ecas_unq" ON "billing_flashlights" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "bir_table_idx" ON "billing_import_runs" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "bir_started_at_idx" ON "billing_import_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bmd_ecas_unq" ON "billing_manual_debentures" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "bmd_book_idx" ON "billing_manual_debentures" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "bmc_customer_idx" ON "billing_meter_changes" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bmc_ecas_unq" ON "billing_meter_changes" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bm_year_month_unq" ON "billing_months" USING btree ("year","month");--> statement-breakpoint
CREATE UNIQUE INDEX "bpg_ecas_unq" ON "billing_payment_groups" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "bpg_period_idx" ON "billing_payment_groups" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "bpg_cashier_idx" ON "billing_payment_groups" USING btree ("cashier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bpay_ecas_unq" ON "billing_payments" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "bpay_period_idx" ON "billing_payments" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "bpay_customer_idx" ON "billing_payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "bpay_cashier_idx" ON "billing_payments" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "bpay_paid_at_idx" ON "billing_payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "bpay_station_idx" ON "billing_payments" USING btree ("station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bps_period_station_unq" ON "billing_period_summary" USING btree ("period_id","station_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bp_ecas_unq" ON "billing_periods" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "bp_year_month_part_idx" ON "billing_periods" USING btree ("year","month","part");--> statement-breakpoint
CREATE UNIQUE INDEX "bph_ecas_unq" ON "billing_phases" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE UNIQUE INDEX "breg_ecas_unq" ON "billing_registers" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "breg_station_idx" ON "billing_registers" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "bscr_menu_idx" ON "billing_screens" USING btree ("menu_key","menu_index");--> statement-breakpoint
CREATE UNIQUE INDEX "bsq_ecas_unq" ON "billing_squares" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "bsq_station_idx" ON "billing_squares" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "bsq_register_idx" ON "billing_squares" USING btree ("register_id");--> statement-breakpoint
CREATE INDEX "bs_ecas_db_idx" ON "billing_stations" USING btree ("ecas_db");--> statement-breakpoint
CREATE UNIQUE INDEX "bts_ecas_unq" ON "billing_tariff_slices" USING btree ("ecas_db","ecas_id");--> statement-breakpoint
CREATE INDEX "bts_activity_idx" ON "billing_tariff_slices" USING btree ("activity_type_id");