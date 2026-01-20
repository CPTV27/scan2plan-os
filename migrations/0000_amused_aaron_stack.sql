CREATE TYPE "public"."user_role" AS ENUM('ceo', 'sales', 'production', 'accounting', 'marketing');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_type" text NOT NULL,
	"actual_balance" numeric(14, 2) DEFAULT '0',
	"virtual_balance" numeric(14, 2) DEFAULT '0',
	"allocation_percent" numeric(5, 2) NOT NULL,
	"notes" text,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"base_prompt" text NOT NULL,
	"optimized_prompt" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"performance" jsonb DEFAULT '{"usageCount":0,"successRate":50,"avgConfidence":50,"lastUsed":""}'::jsonb,
	"metadata" jsonb DEFAULT '{"createdBy":"system","version":1}'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"feature" text NOT NULL,
	"user_id" text,
	"lead_id" integer,
	"action" text,
	"time_taken_ms" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_fact_citations" (
	"id" serial PRIMARY KEY NOT NULL,
	"memory_id" integer NOT NULL,
	"agent" text NOT NULL,
	"context" text,
	"used_in_output_id" integer,
	"was_helpful" boolean,
	"feedback" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_learning_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent" text NOT NULL,
	"interaction_type" text NOT NULL,
	"interaction_id" integer,
	"learned_facts" jsonb,
	"confidence_delta" integer,
	"applied_to_memory_ids" jsonb,
	"reasoning" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_research_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic" text NOT NULL,
	"category" text NOT NULL,
	"summary" text NOT NULL,
	"details" jsonb,
	"source_type" text,
	"source_url" text,
	"source_id" integer,
	"confidence" integer DEFAULT 70,
	"citation_count" integer DEFAULT 0,
	"last_cited_at" timestamp,
	"is_verified" boolean DEFAULT false,
	"verified_by" text,
	"verified_at" timestamp,
	"expires_at" timestamp,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"related_memory_ids" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "brand_personas" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"core_identity" text NOT NULL,
	"voice_mode" jsonb,
	"mantra" text,
	"directives" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brand_personas_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "brand_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_voices" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"base_instruction" text NOT NULL,
	"tone_markers" jsonb,
	"prohibitions" jsonb,
	"example_output" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brand_voices_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "buyer_personas" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"role_title" text NOT NULL,
	"role_variants" jsonb,
	"organization_type" text,
	"description" text,
	"core_values" jsonb,
	"primary_pain" text NOT NULL,
	"secondary_pain" text,
	"hidden_fear" text,
	"purchase_triggers" jsonb,
	"value_driver" text NOT NULL,
	"value_hook" text,
	"exact_language" jsonb,
	"avoid_words" jsonb,
	"decision_criteria" jsonb,
	"dealbreakers" jsonb,
	"project_phases" jsonb,
	"budget_authority" text,
	"typical_budget_range" text,
	"influence_chain" jsonb,
	"tone_preference" text NOT NULL,
	"communication_style" text,
	"attention_span" text,
	"technical_triggers" jsonb,
	"emotional_triggers" jsonb,
	"veto_power" boolean DEFAULT false,
	"default_risk_level" text DEFAULT 'medium',
	"disqualifiers" jsonb,
	"buying_mode_strategies" jsonb,
	"required_assets" jsonb,
	"proposal_sections" jsonb,
	"win_rate" numeric(5, 2),
	"avg_deal_size" numeric(12, 2),
	"avg_sales_cycle_days" integer,
	"total_deals" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "buyer_personas_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "case_studies" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"blurb" text NOT NULL,
	"tags" text[] NOT NULL,
	"image_url" text,
	"stats" jsonb,
	"client_name" text,
	"hero_stat" text,
	"pdf_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_study_snippets" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_study_id" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"snippet_type" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_capabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text DEFAULT 'core' NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"details" jsonb,
	"sort_order" integer DEFAULT 0,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compensation_splits" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"type" text DEFAULT 'commission',
	"default_rate" numeric(5, 2) DEFAULT '5.00',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cpq_cad_pricing_matrix" (
	"id" serial PRIMARY KEY NOT NULL,
	"building_type_id" integer NOT NULL,
	"area_tier" text NOT NULL,
	"package_type" text NOT NULL,
	"rate_per_sq_ft" numeric(10, 4) NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cpq_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"user_id" text,
	"messages" jsonb,
	"extracted_data" jsonb,
	"quote_id" integer,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cpq_pricing_matrix" (
	"id" serial PRIMARY KEY NOT NULL,
	"building_type_id" integer NOT NULL,
	"area_tier" text NOT NULL,
	"discipline" text NOT NULL,
	"lod" text NOT NULL,
	"rate_per_sq_ft" numeric(10, 4) NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cpq_pricing_parameters" (
	"id" serial PRIMARY KEY NOT NULL,
	"parameter_key" text NOT NULL,
	"parameter_value" text NOT NULL,
	"parameter_type" text NOT NULL,
	"description" text,
	"category" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "cpq_pricing_parameters_parameter_key_unique" UNIQUE("parameter_key")
);
--> statement-breakpoint
CREATE TABLE "cpq_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"quote_number" text NOT NULL,
	"client_name" text,
	"project_name" text NOT NULL,
	"project_address" text NOT NULL,
	"specific_building" text,
	"type_of_building" text NOT NULL,
	"has_basement" boolean DEFAULT false,
	"has_attic" boolean DEFAULT false,
	"notes" text,
	"scoping_mode" boolean DEFAULT false NOT NULL,
	"areas" jsonb NOT NULL,
	"risks" jsonb DEFAULT '[]' NOT NULL,
	"dispatch_location" text NOT NULL,
	"distance" integer,
	"custom_travel_cost" numeric(12, 2),
	"services" jsonb DEFAULT '{}' NOT NULL,
	"scoping_data" jsonb,
	"total_price" numeric(12, 2),
	"pricing_breakdown" jsonb,
	"parent_quote_id" integer,
	"version_number" integer DEFAULT 1 NOT NULL,
	"version_name" text,
	"is_latest" boolean DEFAULT true NOT NULL,
	"travel" jsonb,
	"payment_terms" text DEFAULT 'standard',
	"site_status" text,
	"mep_scope" text,
	"act_scanning" text,
	"scanning_only" text,
	"act_scanning_notes" text,
	"client_token" text,
	"client_token_expires_at" timestamp,
	"client_status" text DEFAULT 'pending',
	"external_cpq_id" text,
	"external_cpq_url" text,
	"pandadoc_document_id" text,
	"pandadoc_status" text,
	"pandadoc_sent_at" timestamp,
	"pandadoc_completed_at" timestamp,
	"pandadoc_signed_by" text,
	"signature_provider" text,
	"signature_submission_id" text,
	"signature_status" text,
	"signature_sent_at" timestamp,
	"signature_signed_at" timestamp,
	"field_affirmations" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cpq_upteam_pricing_matrix" (
	"id" serial PRIMARY KEY NOT NULL,
	"building_type_id" integer NOT NULL,
	"area_tier" text NOT NULL,
	"discipline" text NOT NULL,
	"lod" text NOT NULL,
	"rate_per_sq_ft" numeric(10, 4) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_attributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"touchpoint" text NOT NULL,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"predicted_probability" integer,
	"predicted_outcome" text,
	"actual_outcome" text,
	"prediction_date" timestamp DEFAULT now(),
	"outcome_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer NOT NULL,
	"gmail_message_id" text,
	"from_email" text NOT NULL,
	"from_name" text,
	"to_emails" jsonb DEFAULT '[]'::jsonb,
	"cc_emails" jsonb DEFAULT '[]'::jsonb,
	"subject" text,
	"body_preview" text,
	"body_html" text,
	"has_attachments" boolean DEFAULT false,
	"attachment_names" jsonb DEFAULT '[]'::jsonb,
	"is_inbound" boolean DEFAULT true,
	"sent_at" timestamp NOT NULL,
	"synced_at" timestamp DEFAULT now(),
	CONSTRAINT "email_messages_gmail_message_id_unique" UNIQUE("gmail_message_id")
);
--> statement-breakpoint
CREATE TABLE "email_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"gmail_thread_id" text,
	"subject" text,
	"participants" jsonb DEFAULT '[]'::jsonb,
	"snippet" text,
	"message_count" integer DEFAULT 0,
	"has_attachments" boolean DEFAULT false,
	"is_unread" boolean DEFAULT false,
	"last_message_at" timestamp,
	"synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "email_threads_gmail_thread_id_unique" UNIQUE("gmail_thread_id")
);
--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"lead_id" integer NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"registered_at" timestamp DEFAULT now(),
	"attended_at" timestamp,
	"certificate_sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"date" timestamp NOT NULL,
	"type" text DEFAULT 'webinar' NOT NULL,
	"ceu_credits" numeric(4, 2) DEFAULT '0',
	"location" text,
	"max_attendees" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "evidence_vault" (
	"id" serial PRIMARY KEY NOT NULL,
	"persona_code" text,
	"hook_content" text,
	"ews_score" integer,
	"source_url" text,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"qb_expense_id" text,
	"lead_id" integer,
	"project_id" integer,
	"tech_id" text,
	"vendor_name" text,
	"description" text,
	"amount" numeric(12, 2) NOT NULL,
	"expense_date" timestamp,
	"category" text,
	"account_name" text,
	"source" text DEFAULT 'field',
	"is_billable" boolean DEFAULT true,
	"receipt_url" text,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "expenses_qb_expense_id_unique" UNIQUE("qb_expense_id")
);
--> statement-breakpoint
CREATE TABLE "field_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"lead_id" integer,
	"raw_content" text NOT NULL,
	"processed_scope" text,
	"status" text DEFAULT 'Pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "generated_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"quote_id" integer,
	"template_group_id" integer,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft',
	"sections" jsonb DEFAULT '[]'::jsonb,
	"pdf_url" text,
	"pdf_generated_at" timestamp,
	"pandadoc_document_id" text,
	"pandadoc_status" text,
	"pandadoc_sent_at" timestamp,
	"pandadoc_completed_at" timestamp,
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "generation_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"prompt_context" text NOT NULL,
	"buyer_type" text,
	"pain_point" text,
	"situation" text,
	"initial_draft" text NOT NULL,
	"violation_count" integer DEFAULT 0 NOT NULL,
	"violations_found" jsonb,
	"rewrite_attempts" integer DEFAULT 0 NOT NULL,
	"final_output" text NOT NULL,
	"persona_used" text,
	"author_mode" text,
	"processing_time_ms" integer,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghl_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"ghl_contact_id" text,
	"ghl_opportunity_id" text,
	"sync_status" text,
	"error_message" text,
	"last_sync_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "governance_red_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_content" text NOT NULL,
	"violation_category" text NOT NULL,
	"correction_instruction" text NOT NULL,
	"severity" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_published" boolean DEFAULT true,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "help_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "hubspot_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"hubspot_contact_id" text,
	"sync_status" text,
	"error_message" text,
	"last_sync_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "intel_agent_outputs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"agent" text NOT NULL,
	"output" jsonb,
	"duration_ms" integer,
	"confidence" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "intel_feed_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb,
	"is_active" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "intel_news_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"source_url" text,
	"source_name" text,
	"region" text,
	"deadline" timestamp,
	"estimated_value" numeric(12, 2),
	"project_type" text,
	"effective_date" timestamp,
	"agency" text,
	"competitor_name" text,
	"is_read" boolean DEFAULT false,
	"is_actionable" boolean DEFAULT true,
	"is_archived" boolean DEFAULT false,
	"relevance_score" integer DEFAULT 50,
	"metadata" jsonb,
	"published_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "intel_pipeline_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"intel_item_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_agent" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text,
	"retry_count" integer DEFAULT 0,
	"executive_summary" text,
	"recommended_actions" jsonb,
	"draft_email" text,
	"audit_score" integer,
	"audit_verdict" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "intelligence_generated_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"target_persona" text,
	"project_context" jsonb,
	"input_prompt" text,
	"generated_output" text NOT NULL,
	"voice_used" text,
	"quality_score" integer,
	"was_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_account_type" text NOT NULL,
	"to_account_type" text NOT NULL,
	"original_amount" numeric(14, 2) NOT NULL,
	"amount_repaid" numeric(14, 2) DEFAULT '0',
	"remaining_balance" numeric(14, 2) NOT NULL,
	"reason" text,
	"loan_date" timestamp NOT NULL,
	"target_repay_date" timestamp,
	"is_fully_repaid" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"project_id" integer,
	"invoice_number" text NOT NULL,
	"client_name" text NOT NULL,
	"description" text,
	"total_amount" numeric(14, 2) NOT NULL,
	"amount_paid" numeric(14, 2) DEFAULT '0',
	"interest_accrued" numeric(14, 2) DEFAULT '0',
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"status" text DEFAULT 'Sent' NOT NULL,
	"days_overdue" integer DEFAULT 0,
	"is_high_risk" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lead_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by" text,
	"uploaded_at" timestamp DEFAULT now(),
	"moved_to_drive_at" timestamp,
	"drive_file_id" text,
	"drive_file_url" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "lead_research" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"research_type" text NOT NULL,
	"summary" text NOT NULL,
	"highlights" text,
	"citations" text,
	"raw_response" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_code" text,
	"client_name" text NOT NULL,
	"project_name" text,
	"project_address" text,
	"project_zip_code" text,
	"value" numeric(12, 2) DEFAULT '0',
	"deal_stage" text DEFAULT 'Leads' NOT NULL,
	"probability" integer DEFAULT 0,
	"last_contact_date" timestamp DEFAULT now(),
	"closed_at" timestamp,
	"loss_reason" text,
	"won_reason" text,
	"notes" text,
	"retainer_paid" boolean DEFAULT false,
	"retainer_amount" numeric(12, 2),
	"retainer_paid_date" timestamp,
	"legal_jurisdiction" text DEFAULT 'Welor County',
	"quote_number" text,
	"building_type" text,
	"sqft" integer,
	"scope" text,
	"disciplines" text,
	"bim_deliverable" text,
	"bim_version" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"billing_contact_name" text,
	"billing_contact_email" text,
	"billing_contact_phone" text,
	"dispatch_location" text,
	"distance" integer,
	"travel_rate" numeric(6, 2),
	"timeline" text,
	"payment_terms" text,
	"quote_url" text,
	"quote_version" integer,
	"cpq_areas" jsonb,
	"cpq_risks" jsonb,
	"cpq_travel" jsonb,
	"cpq_services" jsonb,
	"cpq_scoping_data" jsonb,
	"lead_source" text,
	"source" text DEFAULT 'cold_outreach',
	"referrer_company_name" text,
	"referrer_contact_name" text,
	"lead_priority" integer DEFAULT 3,
	"buyer_persona" text,
	"complexity_score" text,
	"client_tier" text,
	"regulatory_risks" jsonb,
	"ai_insights_updated_at" timestamp,
	"google_intel" jsonb,
	"integrity_status" text,
	"integrity_flags" jsonb,
	"requires_override" boolean DEFAULT false,
	"override_approved" boolean DEFAULT false,
	"override_approved_by" text,
	"override_approved_at" timestamp,
	"drive_folder_id" text,
	"drive_folder_url" text,
	"storage_mode" text DEFAULT 'legacy_drive',
	"gcs_bucket" text,
	"gcs_path" text,
	"qbo_estimate_id" text,
	"qbo_estimate_number" text,
	"qbo_estimate_status" text,
	"qbo_invoice_id" text,
	"qbo_invoice_number" text,
	"qbo_customer_id" text,
	"qbo_synced_at" timestamp,
	"qbo_has_linked_invoice" boolean DEFAULT false,
	"import_source" text,
	"pandadoc_id" text,
	"pandadoc_status" text,
	"pandadoc_sent_at" timestamp,
	"hubspot_id" text,
	"ghl_contact_id" text,
	"ghl_opportunity_id" text,
	"lead_score" integer DEFAULT 0,
	"owner_id" text,
	"abm_tier" text DEFAULT 'None',
	"firm_size" text,
	"discipline" text,
	"focus_sector" text,
	"estimator_card_id" text,
	"estimator_card_url" text,
	"project_status" jsonb,
	"proof_links" text,
	"site_readiness" jsonb,
	"site_readiness_questions_sent" jsonb,
	"site_readiness_status" text DEFAULT 'pending',
	"site_readiness_sent_at" timestamp,
	"site_readiness_completed_at" timestamp,
	"client_token" text,
	"client_token_expires_at" timestamp,
	"field_affirmations" jsonb,
	"missing_info" jsonb,
	"deleted_at" timestamp,
	"deleted_by" text,
	"mautic_contact_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_intel" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"insights" jsonb DEFAULT '[]'::jsonb,
	"action_items" jsonb DEFAULT '[]'::jsonb,
	"related_leads" jsonb,
	"related_projects" jsonb,
	"confidence" integer DEFAULT 50,
	"source" text,
	"metadata" jsonb,
	"is_actioned" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "marketing_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_study_id" integer,
	"project_id" integer,
	"platform" text DEFAULT 'linkedin',
	"category" text,
	"content" text,
	"suggested_visual" text,
	"status" text DEFAULT 'draft',
	"variance_percent" numeric(10, 2),
	"savings_amount" numeric(12, 2),
	"posted_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mission_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"tech_id" text NOT NULL,
	"mission_date" timestamp DEFAULT now(),
	"start_travel_time" timestamp,
	"arrive_site_time" timestamp,
	"leave_site_time" timestamp,
	"arrive_home_time" timestamp,
	"start_travel_manual" boolean DEFAULT false,
	"arrive_site_manual" boolean DEFAULT false,
	"leave_site_manual" boolean DEFAULT false,
	"arrive_home_manual" boolean DEFAULT false,
	"travel_duration_minutes" integer,
	"scanning_duration_minutes" integer,
	"status" text DEFAULT 'in_progress',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "negotiation_playbook" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_code" text NOT NULL,
	"objection_pattern" text NOT NULL,
	"underlying_concern" text,
	"response_strategy" text NOT NULL,
	"reframe_language" text,
	"walk_away_signal" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"type" text,
	"title" text,
	"lead_id" integer,
	"quote_id" integer,
	"message" text,
	"read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pandadoc_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer,
	"pandadoc_id" text NOT NULL,
	"pandadoc_name" text,
	"pandadoc_status" text,
	"pandadoc_status_code" integer,
	"pandadoc_stage" text DEFAULT 'unknown',
	"pandadoc_version" text,
	"pandadoc_created_at" timestamp,
	"pandadoc_updated_at" timestamp,
	"pandadoc_pdf_url" text,
	"import_status" text DEFAULT 'pending' NOT NULL,
	"extracted_data" jsonb,
	"extraction_confidence" numeric(5, 2),
	"extraction_errors" jsonb,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_notes" text,
	"cpq_quote_id" integer,
	"lead_id" integer,
	"raw_pandadoc_data" jsonb,
	"pricing_table_data" jsonb,
	"recipients_data" jsonb,
	"variables_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pandadoc_documents_pandadoc_id_unique" UNIQUE("pandadoc_id")
);
--> statement-breakpoint
CREATE TABLE "pandadoc_import_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_documents" integer DEFAULT 0,
	"processed_documents" integer DEFAULT 0,
	"successful_documents" integer DEFAULT 0,
	"failed_documents" integer DEFAULT 0,
	"last_sync_cursor" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"persona_id" integer,
	"lead_id" integer,
	"buying_mode_used" text,
	"strategy_notes" text,
	"assets_delivered" jsonb,
	"outcome" text NOT NULL,
	"deal_value" numeric(12, 2),
	"cycle_length_days" integer,
	"loss_reason" text,
	"ai_analysis" text,
	"suggested_refinements" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"pain_points" text[],
	"preferred_tags" text[],
	"script_template" text,
	CONSTRAINT "personas_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"type" text DEFAULT 'Service',
	"price" numeric(12, 2) DEFAULT '0',
	"pricing_model" text DEFAULT 'Fixed',
	"attributes" jsonb,
	"qbo_item_id" text,
	"qbo_account_name" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "project_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"lead_id" integer,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer,
	"drive_file_id" text NOT NULL,
	"drive_file_url" text NOT NULL,
	"drive_download_url" text,
	"thumbnail_url" text,
	"subfolder" text DEFAULT '01_Field_Capture',
	"source" text DEFAULT 'manual',
	"uploaded_by" text,
	"status" text DEFAULT 'ready',
	"ai_tags" jsonb,
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"embedding" text,
	"project_summary" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"universal_project_id" text,
	"lead_id" integer,
	"assigned_tech_id" integer,
	"name" text NOT NULL,
	"status" text DEFAULT 'Scheduling' NOT NULL,
	"priority" text DEFAULT 'Medium',
	"due_date" timestamp,
	"progress" integer DEFAULT 0,
	"target_lod" text DEFAULT 'LOD 300',
	"target_loa_measured" text DEFAULT 'LoA 40',
	"target_loa_modeled" text DEFAULT 'LoA 30',
	"estimated_sqft" integer,
	"actual_sqft" integer,
	"sqft_variance" numeric(5, 2),
	"sqft_audit_complete" boolean DEFAULT false,
	"billing_adjustment_approved" boolean DEFAULT false,
	"b_validation_status" text DEFAULT 'pending',
	"c_validation_status" text DEFAULT 'pending',
	"registration_rms" numeric(6, 3),
	"registration_passed_at" timestamp,
	"registration_notes" text,
	"leed_carbon_enabled" boolean DEFAULT false,
	"gwp_baseline" numeric(12, 2),
	"gwp_actual" numeric(12, 2),
	"gwp_reduction_target" integer DEFAULT 10,
	"bom_materials" jsonb,
	"bom_notes" text,
	"drive_folder_id" text,
	"drive_folder_url" text,
	"drive_folder_status" text DEFAULT 'pending',
	"drive_subfolders" jsonb,
	"scan_date" timestamp,
	"calendar_event_id" text,
	"travel_distance_miles" numeric(8, 2),
	"travel_duration_minutes" integer,
	"travel_scenario" text,
	"chat_space_id" text,
	"chat_space_url" text,
	"storage_mode" text DEFAULT 'legacy_drive',
	"gcs_bucket" text,
	"gcs_path" text,
	"vendor_cost_actual" numeric(12, 2),
	"margin_actual" numeric(12, 2),
	"margin_percent" numeric(5, 2),
	"potree_path" text,
	"viewer_url" text,
	"delivery_status" text DEFAULT 'pending',
	"quoted_price" numeric(12, 2),
	"quoted_margin" numeric(5, 2),
	"quoted_areas" jsonb,
	"quoted_risks" jsonb,
	"quoted_travel" jsonb,
	"quoted_services" jsonb,
	"site_readiness" jsonb,
	"client_name" text,
	"client_contact" text,
	"client_email" text,
	"client_phone" text,
	"project_address" text,
	"dispatch_location" text,
	"distance" integer,
	"scope_summary" text,
	"field_affirmations" jsonb,
	"scanner_type" text DEFAULT 'trimble_x7',
	"matterport_required" boolean DEFAULT false,
	"drone_required" boolean DEFAULT false,
	"extension_tripod_needed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "projects_universal_project_id_unique" UNIQUE("universal_project_id")
);
--> statement-breakpoint
CREATE TABLE "proposal_email_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"quote_id" integer,
	"token" text NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_name" text,
	"subject" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"first_opened_at" timestamp,
	"last_opened_at" timestamp,
	"open_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "proposal_email_events_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "proposal_template_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sections" jsonb DEFAULT '[]'::jsonb,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "proposal_template_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "proposal_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text DEFAULT 'boilerplate' NOT NULL,
	"content" text NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" text,
	CONSTRAINT "proposal_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "qb_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"qb_id" text NOT NULL,
	"display_name" text NOT NULL,
	"company_name" text,
	"email" text,
	"phone" text,
	"mobile" text,
	"fax" text,
	"billing_line1" text,
	"billing_line2" text,
	"billing_city" text,
	"billing_state" text,
	"billing_postal_code" text,
	"billing_country" text,
	"shipping_line1" text,
	"shipping_line2" text,
	"shipping_city" text,
	"shipping_state" text,
	"shipping_postal_code" text,
	"shipping_country" text,
	"balance" numeric(12, 2),
	"active" boolean DEFAULT true,
	"website" text,
	"industry" text,
	"employee_count" text,
	"linkedin_url" text,
	"marketing_status" text DEFAULT 'Lead',
	"tags" text[],
	"notes" text,
	"enrichment_data" jsonb,
	"synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "qb_customers_qb_id_unique" UNIQUE("qb_id")
);
--> statement-breakpoint
CREATE TABLE "quickbooks_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"realm_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"refresh_expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"cpq_quote_id" text,
	"quote_url" text,
	"price_snapshot" jsonb,
	"summary" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rfp_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"original_file_name" text,
	"file_url" text,
	"file_type" text,
	"extracted_data" jsonb,
	"generated_lead_id" integer,
	"generated_quote_id" integer,
	"generated_proposal_id" integer,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_notes" text,
	"pandadoc_document_id" text,
	"sent_at" timestamp,
	"sent_to" text,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_reps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"commission_rate" numeric(5, 2) DEFAULT '5.00',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sales_reps_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "scantechs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"base_location" text NOT NULL,
	"can_do_travel" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sequence_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"sequence_id" integer NOT NULL,
	"current_step" integer DEFAULT 1,
	"status" text DEFAULT 'active',
	"next_execution_at" timestamp,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sequence_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"sequence_id" integer NOT NULL,
	"step_order" integer NOT NULL,
	"delay_days" integer DEFAULT 0,
	"type" text DEFAULT 'email' NOT NULL,
	"subject" text,
	"content" text,
	"template_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_type" text DEFAULT 'manual',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "site_intelligence" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"tech_id" text NOT NULL,
	"video_url" text,
	"audio_url" text,
	"transcript" text,
	"ai_summary" text,
	"obstructions" text,
	"lighting_conditions" text,
	"confirmed_areas" text,
	"scope_changes" text,
	"status" text DEFAULT 'recording',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "solution_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_code" text NOT NULL,
	"pain_point" text NOT NULL,
	"solution_mechanism" text NOT NULL,
	"proof_point" text,
	"argument_frame" text NOT NULL,
	"objection_preempt" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standard_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"term" text NOT NULL,
	"definition" text NOT NULL,
	"guarantee_text" text,
	"category" text DEFAULT 'general',
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "standard_definitions_term_unique" UNIQUE("term")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"overhead_rate" numeric(5, 2) DEFAULT '15.00',
	"target_net_margin" numeric(5, 2) DEFAULT '20.00',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"tech_id" text NOT NULL,
	"arrival_time" timestamp,
	"departure_time" timestamp,
	"total_site_minutes" integer,
	"type" text DEFAULT 'Automatic',
	"work_type" text DEFAULT 'Scanning',
	"role_type" text DEFAULT 'tech',
	"hourly_cost" numeric(10, 2),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tracking_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"event_type" text,
	"asset_url" text,
	"clicked_at" timestamp DEFAULT now(),
	"referrer" text
);
--> statement-breakpoint
CREATE TABLE "vendor_payables" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_name" text NOT NULL,
	"description" text,
	"amount" numeric(14, 2) NOT NULL,
	"due_date" timestamp,
	"is_recurring" boolean DEFAULT false,
	"recurring_frequency" text,
	"priority" integer DEFAULT 3,
	"is_paid" boolean DEFAULT false,
	"paid_date" timestamp,
	"category" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendor_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"discipline" text,
	"lod" text,
	"tier" text DEFAULT 'standard',
	"rate_per_sqft" numeric(10, 4)
);
--> statement-breakpoint
CREATE TABLE "x_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"x_user_id" text,
	"x_username" text,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"scopes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "x_monitored_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"x_username" text NOT NULL,
	"x_user_id" text,
	"display_name" text,
	"category" text DEFAULT 'competitor',
	"notes" text,
	"is_active" boolean DEFAULT true,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "x_saved_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"category" text DEFAULT 'opportunity',
	"description" text,
	"is_active" boolean DEFAULT true,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"success" varchar NOT NULL,
	"ip_address" varchar,
	"attempted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" "user_role" DEFAULT 'ceo' NOT NULL,
	"scantec_home" varchar,
	"password_hash" varchar,
	"password_set_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_study_snippets" ADD CONSTRAINT "case_study_snippets_case_study_id_case_studies_id_fk" FOREIGN KEY ("case_study_id") REFERENCES "public"."case_studies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpq_conversations" ADD CONSTRAINT "cpq_conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpq_quotes" ADD CONSTRAINT "cpq_quotes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_attributions" ADD CONSTRAINT "deal_attributions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_predictions" ADD CONSTRAINT "deal_predictions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_notes" ADD CONSTRAINT "field_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_notes" ADD CONSTRAINT "field_notes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_proposals" ADD CONSTRAINT "generated_proposals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_proposals" ADD CONSTRAINT "generated_proposals_quote_id_cpq_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."cpq_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_proposals" ADD CONSTRAINT "generated_proposals_template_group_id_proposal_template_groups_id_fk" FOREIGN KEY ("template_group_id") REFERENCES "public"."proposal_template_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghl_sync_logs" ADD CONSTRAINT "ghl_sync_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubspot_sync_logs" ADD CONSTRAINT "hubspot_sync_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_research" ADD CONSTRAINT "lead_research_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_posts" ADD CONSTRAINT "marketing_posts_case_study_id_case_studies_id_fk" FOREIGN KEY ("case_study_id") REFERENCES "public"."case_studies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_posts" ADD CONSTRAINT "marketing_posts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_logs" ADD CONSTRAINT "mission_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pandadoc_documents" ADD CONSTRAINT "pandadoc_documents_batch_id_pandadoc_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."pandadoc_import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pandadoc_documents" ADD CONSTRAINT "pandadoc_documents_cpq_quote_id_cpq_quotes_id_fk" FOREIGN KEY ("cpq_quote_id") REFERENCES "public"."cpq_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pandadoc_documents" ADD CONSTRAINT "pandadoc_documents_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_insights" ADD CONSTRAINT "persona_insights_persona_id_buyer_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."buyer_personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_insights" ADD CONSTRAINT "persona_insights_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_attachments" ADD CONSTRAINT "project_attachments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_attachments" ADD CONSTRAINT "project_attachments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_embeddings" ADD CONSTRAINT "project_embeddings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_assigned_tech_id_scantechs_id_fk" FOREIGN KEY ("assigned_tech_id") REFERENCES "public"."scantechs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_email_events" ADD CONSTRAINT "proposal_email_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_email_events" ADD CONSTRAINT "proposal_email_events_quote_id_cpq_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."cpq_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfp_submissions" ADD CONSTRAINT "rfp_submissions_generated_lead_id_leads_id_fk" FOREIGN KEY ("generated_lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfp_submissions" ADD CONSTRAINT "rfp_submissions_generated_proposal_id_generated_proposals_id_fk" FOREIGN KEY ("generated_proposal_id") REFERENCES "public"."generated_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_intelligence" ADD CONSTRAINT "site_intelligence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");