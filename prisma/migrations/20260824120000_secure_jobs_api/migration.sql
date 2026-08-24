ALTER TABLE "Job" ADD COLUMN "referenceNo" TEXT;
ALTER TABLE "Job" ADD COLUMN "jdText" TEXT;
ALTER TABLE "Job" ADD COLUMN "locations" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Job" ADD COLUMN "remoteScope" TEXT;
ALTER TABLE "Job" ADD COLUMN "country" TEXT;
ALTER TABLE "Job" ADD COLUMN "state" TEXT;
ALTER TABLE "Job" ADD COLUMN "city" TEXT;
ALTER TABLE "Job" ADD COLUMN "primaryTimeZone" TEXT;
ALTER TABLE "Job" ADD COLUMN "supportedTimeZones" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Job" ADD COLUMN "workingHours" TEXT;
ALTER TABLE "Job" ADD COLUMN "minTimeZoneOverlap" INTEGER;
ALTER TABLE "Job" ADD COLUMN "minBillingRate" REAL;
ALTER TABLE "Job" ADD COLUMN "maxBillingRate" REAL;
ALTER TABLE "Job" ADD COLUMN "billingRateType" TEXT;
ALTER TABLE "Job" ADD COLUMN "compensationUndisclosed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Job" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Job" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "Job" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "Job" ADD COLUMN "assignedRecruiterId" TEXT;
ALTER TABLE "Job" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Job" ADD COLUMN "updatedByUserId" TEXT;
ALTER TABLE "Job" ADD COLUMN "openedAt" DATETIME;
ALTER TABLE "Job" ADD COLUMN "targetClosureAt" DATETIME;
ALTER TABLE "Job" ADD COLUMN "closedAt" DATETIME;
ALTER TABLE "Job" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "Job" ADD COLUMN "legacyData" JSONB;

CREATE UNIQUE INDEX "Job_referenceNo_key" ON "Job"("referenceNo");
CREATE INDEX "Job_assignedRecruiterId_idx" ON "Job"("assignedRecruiterId");
CREATE INDEX "Job_archivedAt_idx" ON "Job"("archivedAt");

CREATE TABLE "JobAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "jobTitle" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "reason" TEXT,
  "changes" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "JobAudit_jobId_createdAt_idx" ON "JobAudit"("jobId", "createdAt");
CREATE INDEX "JobAudit_actorId_createdAt_idx" ON "JobAudit"("actorId", "createdAt");

CREATE TABLE "CandidatePool" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "techStack" TEXT NOT NULL,
  "sourceJobId" TEXT,
  "criteria" JSONB NOT NULL DEFAULT '{}',
  "sourceInsight" JSONB,
  "createdByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "CandidatePool_techStack_createdAt_idx" ON "CandidatePool"("techStack", "createdAt");
CREATE INDEX "CandidatePool_createdByUserId_idx" ON "CandidatePool"("createdByUserId");

CREATE TABLE "CandidatePoolMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "poolId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "matchReason" JSONB,
  "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidatePoolMember_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CandidatePool" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CandidatePoolMember_poolId_candidateId_key" ON "CandidatePoolMember"("poolId", "candidateId");
CREATE INDEX "CandidatePoolMember_candidateId_idx" ON "CandidatePoolMember"("candidateId");
