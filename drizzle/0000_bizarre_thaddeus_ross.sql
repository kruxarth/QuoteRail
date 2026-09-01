CREATE TYPE "public"."actor_type" AS ENUM('buyer', 'merchant', 'model', 'policy', 'system', 'razorpay');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."offering_category" AS ENUM('hall', 'av', 'catering', 'parking', 'staging', 'operations');--> statement-breakpoint
CREATE TYPE "public"."payment_link_status" AS ENUM('creating', 'issued', 'paid', 'cancelled', 'expired', 'stopped', 'error');--> statement-breakpoint
CREATE TYPE "public"."payment_term" AS ENUM('deposit', 'full');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('hall_slot', 'fixed', 'per_guest');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'policy_rejected', 'pending_approval', 'offered', 'accepted', 'expired', 'superseded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('active', 'committed', 'released', 'expired');--> statement-breakpoint
CREATE TYPE "public"."rfq_message_kind" AS ENUM('initial_request', 'clarification_answer', 'clarification_question', 'revision_request');--> statement-breakpoint
CREATE TYPE "public"."rfq_message_role" AS ENUM('buyer', 'agent');--> statement-breakpoint
CREATE TYPE "public"."rfq_status" AS ENUM('received', 'needs_clarification', 'planning', 'retryable_error', 'quoted', 'escalated', 'closed');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('received', 'processed', 'duplicate', 'ignored', 'failed');--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quote_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "approval_status" NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"decision_note" text
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trace_id" uuid NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"summary" text NOT NULL,
	"reason" text,
	"input_redacted" jsonb,
	"output_redacted" jsonb,
	"rule_ids" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"succeeded" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "offerings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" "offering_category" NOT NULL,
	"pricing_model" "pricing_model" NOT NULL,
	"sale_price_subunits" bigint NOT NULL,
	"cost_subunits" bigint NOT NULL,
	"capacity_units" integer,
	"capacity_label" text,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"acceptance_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_payment_link_id" text,
	"provider_reference_id" text NOT NULL,
	"short_url" text,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"amount_paid" bigint DEFAULT 0 NOT NULL,
	"status" "payment_link_status" NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_failure_code" text,
	"error_code" text,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_links_acceptance_id_unique" UNIQUE("acceptance_id"),
	CONSTRAINT "payment_links_provider_payment_link_id_unique" UNIQUE("provider_payment_link_id"),
	CONSTRAINT "payment_links_provider_reference_id_unique" UNIQUE("provider_reference_id")
);
--> statement-breakpoint
CREATE TABLE "policy_evaluations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quote_id" uuid,
	"action_type" text NOT NULL,
	"allowed" boolean NOT NULL,
	"rule_results" jsonb NOT NULL,
	"summary" text NOT NULL,
	"policy_version" text NOT NULL,
	"trace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_acceptances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"rfq_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_email" text,
	"payment_term" "payment_term" NOT NULL,
	"amount_due_now" bigint NOT NULL,
	"payment_expires_at" timestamp with time zone NOT NULL,
	"acceptance_hash" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"trace_id" uuid NOT NULL,
	CONSTRAINT "quote_acceptances_rfq_id_unique" UNIQUE("rfq_id"),
	CONSTRAINT "quote_acceptances_quote_id_unique" UNIQUE("quote_id"),
	CONSTRAINT "quote_acceptances_acceptance_hash_unique" UNIQUE("acceptance_hash")
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quote_id" uuid NOT NULL,
	"offering_id" uuid NOT NULL,
	"resource_slot_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" "offering_category" NOT NULL,
	"pricing_model" "pricing_model" NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" bigint NOT NULL,
	"unit_cost" bigint NOT NULL,
	"multiplier_bps" integer NOT NULL,
	"line_price" bigint NOT NULL,
	"line_cost" bigint NOT NULL,
	"capabilities" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"rfq_id" uuid NOT NULL,
	"parent_quote_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "quote_status" NOT NULL,
	"currency" text NOT NULL,
	"service_subtotal" bigint NOT NULL,
	"hall_slot_adjustment" bigint NOT NULL,
	"additional_discount" bigint NOT NULL,
	"total_price" bigint NOT NULL,
	"total_cost" bigint NOT NULL,
	"gross_margin_bps" integer NOT NULL,
	"deposit_bps" integer NOT NULL,
	"deposit_amount" bigint NOT NULL,
	"event_starts_at" timestamp with time zone NOT NULL,
	"event_ends_at" timestamp with time zone NOT NULL,
	"attendee_count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"rationale" text NOT NULL,
	"tradeoffs" jsonb NOT NULL,
	"assumptions" jsonb NOT NULL,
	"offering_snapshot_hash" text NOT NULL,
	"policy_snapshot_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_reservations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quote_acceptance_id" uuid NOT NULL,
	"offering_id" uuid NOT NULL,
	"resource_slot_id" uuid NOT NULL,
	"units" integer NOT NULL,
	"reserved_starts_at" timestamp with time zone NOT NULL,
	"reserved_ends_at" timestamp with time zone NOT NULL,
	"status" "reservation_status" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"committed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"offering_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"buffer_starts_at" timestamp with time zone NOT NULL,
	"buffer_ends_at" timestamp with time zone NOT NULL,
	"capacity_total" integer NOT NULL,
	"blocked_units" integer DEFAULT 0 NOT NULL,
	"block_reason" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfq_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"rfq_id" uuid NOT NULL,
	"buyer_subject" text NOT NULL,
	"role" "rfq_message_role" NOT NULL,
	"kind" "rfq_message_kind" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfqs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"buyer_subject" text NOT NULL,
	"raw_request" text NOT NULL,
	"sanitized_request" text NOT NULL,
	"parsed_requirements" jsonb,
	"status" "rfq_status" NOT NULL,
	"clarification_questions" jsonb DEFAULT '[]'::jsonb,
	"prompt_version" text,
	"model_name" text,
	"trace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"body_hash" text NOT NULL,
	"event_type" text NOT NULL,
	"signature_verified" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_status" NOT NULL,
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_body_hash_unique" UNIQUE("body_hash")
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_acceptance_id_quote_acceptances_id_fk" FOREIGN KEY ("acceptance_id") REFERENCES "public"."quote_acceptances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_evaluations" ADD CONSTRAINT "policy_evaluations_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_offering_id_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_resource_slot_id_resource_slots_id_fk" FOREIGN KEY ("resource_slot_id") REFERENCES "public"."resource_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_reservations" ADD CONSTRAINT "resource_reservations_quote_acceptance_id_quote_acceptances_id_fk" FOREIGN KEY ("quote_acceptance_id") REFERENCES "public"."quote_acceptances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_reservations" ADD CONSTRAINT "resource_reservations_offering_id_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_reservations" ADD CONSTRAINT "resource_reservations_resource_slot_id_resource_slots_id_fk" FOREIGN KEY ("resource_slot_id") REFERENCES "public"."resource_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_slots" ADD CONSTRAINT "resource_slots_offering_id_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_messages" ADD CONSTRAINT "rfq_messages_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_trace_idx" ON "audit_events" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auth_attempts_subject_idx" ON "auth_attempts" USING btree ("kind","subject","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "offerings_merchant_code_idx" ON "offerings" USING btree ("merchant_id","code");--> statement-breakpoint
CREATE INDEX "offerings_category_idx" ON "offerings" USING btree ("merchant_id","category");--> statement-breakpoint
CREATE INDEX "payment_links_provider_id_idx" ON "payment_links" USING btree ("provider_payment_link_id");--> statement-breakpoint
CREATE INDEX "payment_links_reference_idx" ON "payment_links" USING btree ("provider_reference_id");--> statement-breakpoint
CREATE INDEX "payment_links_status_idx" ON "payment_links" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotes_rfq_idx" ON "quotes" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotes_expires_at_idx" ON "quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "reservations_offering_idx" ON "resource_reservations" USING btree ("offering_id");--> statement-breakpoint
CREATE INDEX "reservations_slot_idx" ON "resource_reservations" USING btree ("resource_slot_id");--> statement-breakpoint
CREATE INDEX "reservations_status_idx" ON "resource_reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reservations_range_idx" ON "resource_reservations" USING btree ("reserved_starts_at","reserved_ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_slots_offering_range_idx" ON "resource_slots" USING btree ("offering_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "resource_slots_time_idx" ON "resource_slots" USING btree ("offering_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "rfq_messages_rfq_created_idx" ON "rfq_messages" USING btree ("rfq_id","created_at");--> statement-breakpoint
CREATE INDEX "rfqs_created_at_idx" ON "rfqs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rfqs_status_idx" ON "rfqs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rfqs_trace_id_idx" ON "rfqs" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "webhook_events_type_idx" ON "webhook_events" USING btree ("event_type");