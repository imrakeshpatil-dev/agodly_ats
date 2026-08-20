import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildDataPreservingResumePatch,
  type CandidateResumeVersion
} from "../lib/server/services/candidate-resume.service";
import type { CandidateRecord } from "../lib/server/types/candidate";

const candidate: CandidateRecord = {
  id: "candidate-1",
  ownerUserId: "recruiter-1",
  uploadedByUserId: "recruiter-1",
  assignedRecruiterId: "recruiter-1",
  name: "Manual Name",
  email: "manual@example.com",
  phone: "9999999999",
  recruiter: "Recruiter One",
  stage: "Interview",
  jobId: "job-1",
  currentRole: "Manual Role",
  skills: ["Manual Skill"],
  experienceYears: 7,
  profileSummary: "Manual summary",
  keywords: ["manual"],
  location: "Mumbai",
  education: "Manual education",
  currentCompany: "Manual company",
  resumeUrl: "data/resumes/old.pdf",
  parsedData: {
    uploadFileName: "candidates.csv",
    uploadFileType: "CSV",
    originalResume: {
      fileName: "old.pdf",
      resumeUrl: "data/resumes/old.pdf",
      fileType: "PDF"
    },
    notes: ["keep this note"]
  },
  parsingStatus: "COMPLETED",
  source: "CSV Upload (candidates.csv)",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  status: "ACTIVE",
  deletedAt: null,
  duplicateOf: [],
  mergedInto: null
};

const nextVersion: CandidateResumeVersion = {
  versionId: "version-2",
  fileName: "new.pdf",
  fileType: "PDF",
  storedFileName: "stored-new.pdf",
  resumeUrl: "data/resumes/stored-new.pdf",
  mimeType: "application/pdf",
  sizeBytes: 123,
  uploadedAt: "2026-08-20T00:00:00.000Z",
  uploadedBy: "Recruiter One",
  uploadedByUserId: "recruiter-1"
};

test("CV replacement is additive and never overwrites manual candidate profile fields", () => {
  const patch = buildDataPreservingResumePatch(
    candidate,
    nextVersion,
    { fullName: "Parsed Name", email: "parsed@example.com", status: "COMPLETED" },
    "COMPLETED",
    { id: "recruiter-1", name: "Recruiter One", email: "recruiter@agodly.com" },
    "2026-08-20T00:00:00.000Z"
  );

  assert.deepEqual(Object.keys(patch).sort(), ["parsedData", "parsingStatus", "resumeUrl"]);
  assert.equal(patch.resumeUrl, nextVersion.resumeUrl);
  assert.deepEqual((patch.parsedData as Record<string, unknown>).notes, ["keep this note"]);
  const versions = (patch.parsedData as Record<string, unknown>).resumeVersions as Array<Record<string, unknown>>;
  assert.equal(versions.length, 2);
  assert.equal(versions[0].fileName, "new.pdf");
  assert.equal(versions[1].fileName, "old.pdf");
});

test("candidate UI labels CSV as import source and removes raw JSON recruiter controls", () => {
  const browser = fs.readFileSync(path.join(process.cwd(), "app.js"), "utf8");

  assert.match(browser, /CSV import provenance only — this is not a candidate CV/);
  assert.match(browser, /Apply Parsed Data to Draft/);
  assert.match(browser, /Upload CV/);
  assert.match(browser, /Replace CV/);
  assert.doesNotMatch(browser, />Download Candidate JSON</);
  assert.doesNotMatch(browser, />Extracted CV JSON</);
  assert.doesNotMatch(browser, />Clean JSON Preview</);
});
