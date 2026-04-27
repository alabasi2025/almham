CREATE TABLE "billing_screen_action_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screen_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_screen_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_screen_actions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "billing_screen_role_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"screen_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_screen_role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"screen_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_screen_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"start_form_id" integer,
	"start_event_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_screen_roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "billing_screen_action_links" ADD CONSTRAINT "billing_screen_action_links_screen_id_billing_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."billing_screens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_screen_action_links" ADD CONSTRAINT "billing_screen_action_links_action_id_billing_screen_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."billing_screen_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_screen_role_links" ADD CONSTRAINT "billing_screen_role_links_role_id_billing_screen_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."billing_screen_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_screen_role_links" ADD CONSTRAINT "billing_screen_role_links_screen_id_billing_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."billing_screens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_screen_role_permissions" ADD CONSTRAINT "billing_screen_role_permissions_role_id_billing_screen_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."billing_screen_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_screen_role_permissions" ADD CONSTRAINT "billing_screen_role_permissions_screen_id_billing_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."billing_screens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_screen_role_permissions" ADD CONSTRAINT "billing_screen_role_permissions_action_id_billing_screen_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."billing_screen_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bsal_screen_action_unq" ON "billing_screen_action_links" USING btree ("screen_id","action_id");--> statement-breakpoint
CREATE INDEX "bsal_screen_idx" ON "billing_screen_action_links" USING btree ("screen_id");--> statement-breakpoint
CREATE INDEX "bsal_action_idx" ON "billing_screen_action_links" USING btree ("action_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bsrl_role_screen_unq" ON "billing_screen_role_links" USING btree ("role_id","screen_id");--> statement-breakpoint
CREATE INDEX "bsrl_role_idx" ON "billing_screen_role_links" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "bsrl_screen_idx" ON "billing_screen_role_links" USING btree ("screen_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bsrp_role_screen_action_unq" ON "billing_screen_role_permissions" USING btree ("role_id","screen_id","action_id");--> statement-breakpoint
CREATE INDEX "bsrp_role_idx" ON "billing_screen_role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "bsrp_screen_idx" ON "billing_screen_role_permissions" USING btree ("screen_id");--> statement-breakpoint
CREATE INDEX "bsrp_action_idx" ON "billing_screen_role_permissions" USING btree ("action_id");