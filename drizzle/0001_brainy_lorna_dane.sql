ALTER TABLE "lawyers" ALTER COLUMN "specialisations" SET DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "lawyers" ALTER COLUMN "languages" SET DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "lawyers" ALTER COLUMN "regions" SET DEFAULT ARRAY[]::text[];