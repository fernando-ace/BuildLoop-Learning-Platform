CREATE TABLE "operation_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer NOT NULL,
	CONSTRAINT "operation_rate_limits_count_positive" CHECK ("operation_rate_limits"."request_count" > 0)
);
