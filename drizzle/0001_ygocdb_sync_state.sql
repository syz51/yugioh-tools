CREATE TABLE "ygocdb_sync_state" (
	"source" text PRIMARY KEY NOT NULL,
	"md5" text NOT NULL,
	"row_count" integer NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
