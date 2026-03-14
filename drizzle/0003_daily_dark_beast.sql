CREATE TABLE "deck_analysis" (
	"id" text PRIMARY KEY NOT NULL,
	"deck_text" text NOT NULL,
	"source_name" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "deck_analysis_created_at_idx" ON "deck_analysis" USING btree ("created_at");