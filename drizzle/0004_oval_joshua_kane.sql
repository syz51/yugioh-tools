CREATE TABLE "analysis_selection_config" (
	"cfg" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_selection_config" ADD CONSTRAINT "analysis_selection_config_analysis_id_deck_analysis_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."deck_analysis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_selection_config_analysis_id_idx" ON "analysis_selection_config" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "analysis_selection_config_updated_at_idx" ON "analysis_selection_config" USING btree ("updated_at");