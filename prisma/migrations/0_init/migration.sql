-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "recruiter" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'Identified',
    "jobId" TEXT,
    "currentRole" TEXT,
    "skills" JSONB NOT NULL DEFAULT [],
    "experienceYears" REAL,
    "profileSummary" TEXT,
    "keywords" JSONB NOT NULL DEFAULT [],
    "location" TEXT,
    "education" TEXT,
    "currentCompany" TEXT,
    "resumeUrl" TEXT,
    "resumeHash" TEXT,
    "parsedData" JSONB,
    "parsingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" DATETIME,
    "duplicateOf" JSONB NOT NULL DEFAULT [],
    "mergedInto" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "clientId" TEXT,
    "description" TEXT,
    "requiredSkills" JSONB NOT NULL DEFAULT [],
    "preferredSkills" JSONB NOT NULL DEFAULT [],
    "minExperience" REAL,
    "maxExperience" REAL,
    "location" TEXT,
    "workMode" TEXT,
    "jobType" TEXT,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "minCtcLpa" REAL,
    "maxCtcLpa" REAL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AtsUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "addedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiInteraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT,
    "prompt" TEXT NOT NULL,
    "toolCalls" JSONB,
    "response" JSONB,
    "feedback" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT,
    "actor" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuntimeState" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" JSONB NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Candidate_status_createdAt_idx" ON "Candidate"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Candidate_email_idx" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_phone_idx" ON "Candidate"("phone");

-- CreateIndex
CREATE INDEX "Candidate_jobId_idx" ON "Candidate"("jobId");

-- CreateIndex
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_clientId_idx" ON "Job"("clientId");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AtsUser_email_key" ON "AtsUser"("email");

-- CreateIndex
CREATE INDEX "AiInteraction_conversationId_idx" ON "AiInteraction"("conversationId");

-- CreateIndex
CREATE INDEX "AiInteraction_createdAt_idx" ON "AiInteraction"("createdAt");

-- CreateIndex
CREATE INDEX "Activity_candidateId_idx" ON "Activity"("candidateId");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

