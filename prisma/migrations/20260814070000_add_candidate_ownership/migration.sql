ALTER TABLE "Candidate" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "uploadedByUserId" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "assignedRecruiterId" TEXT;

CREATE INDEX "Candidate_ownerUserId_idx" ON "Candidate"("ownerUserId");
CREATE INDEX "Candidate_uploadedByUserId_idx" ON "Candidate"("uploadedByUserId");
CREATE INDEX "Candidate_assignedRecruiterId_idx" ON "Candidate"("assignedRecruiterId");
