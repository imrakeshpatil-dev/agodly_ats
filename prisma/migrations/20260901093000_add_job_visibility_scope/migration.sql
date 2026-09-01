-- Team visibility is the safe default. Existing manager-created jobs become
-- visible to their direct reports as soon as this migration is deployed.
ALTER TABLE "Job" ADD COLUMN "visibilityScope" TEXT NOT NULL DEFAULT 'DIRECT_TEAM';
CREATE INDEX "Job_visibilityScope_idx" ON "Job"("visibilityScope");
