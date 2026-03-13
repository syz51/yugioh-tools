DROP TABLE "card_cache";--> statement-breakpoint
CREATE TABLE "card_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "card_cache_card_id_idx" ON "card_cache" USING btree ("card_id");
