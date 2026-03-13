CREATE TABLE "card_cache" (
	"card_id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
