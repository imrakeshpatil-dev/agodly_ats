import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { BulkUploadService } from "../lib/server/services/bulk-upload.service";
import { candidateStoreService } from "../lib/server/services/candidate-store.service";
import { cvParserService } from "../lib/server/services/cv-parser.service";
import { CandidateInput, CandidateRecord } from "../lib/server/types/candidate";
import {
  buildBlockedDuplicateReason,
  matchCandidateIdentity,
  summarizeCandidateIdentityMatches
} from "../lib/server/utils/candidate-duplicates";

const existingCandidate = {
  email: "candidate@example.com",
  phone: "+91 98765 43210"
};

const parsedCandidate: CandidateInput = {
  name: "Duplicate Candidate",
  email: "candidate@example.com",
  phone: "",
  recruiter: "Bulk Upload",
  stage: "Identified",
  jobId: "",
  currentRole: "Engineer",
  skills: [],
  experienceYears: null,
  profileSummary: "",
  keywords: [],
  location: "",
  education: "",
  currentCompany: "",
  source: "CSV Upload"
};

const storedCandidate: CandidateRecord = {
  ...parsedCandidate,
  id: "candidate-existing",
  ownerUserId: null,
  uploadedByUserId: null,
  assignedRecruiterId: null,
  resumeUrl: "",
  parsedData: null,
  parsingStatus: "COMPLETED",
  createdAt: "2026-08-14T00:00:00.000Z",
  updatedAt: "2026-08-14T00:00:00.000Z",
  status: "ACTIVE",
  deletedAt: null,
  duplicateOf: [],
  mergedInto: null
};

test("duplicate identity matching normalizes email casing and phone formatting", () => {
  assert.deepEqual(
    matchCandidateIdentity(
      { email: "  CANDIDATE@example.com ", phone: "" },
      existingCandidate
    ),
    { email: true, phone: false }
  );

  assert.deepEqual(
    matchCandidateIdentity(
      { email: "different@example.com", phone: "+91-98765-43210" },
      existingCandidate
    ),
    { email: false, phone: true }
  );
});

test("an upload is considered duplicate when either email or phone already exists", () => {
  const matched = summarizeCandidateIdentityMatches(
    { email: "candidate@example.com", phone: "9876543210" },
    [
      { email: "candidate@example.com", phone: "1111111111" },
      { email: "other@example.com", phone: "9876543210" }
    ]
  );

  assert.deepEqual(matched, { email: true, phone: true });
  assert.equal(
    buildBlockedDuplicateReason(
      { email: "candidate@example.com", phone: "9876543210" },
      [
        { email: "candidate@example.com", phone: "1111111111" },
        { email: "other@example.com", phone: "9876543210" }
      ]
    ),
    "Blocked: email and phone already exist in the database"
  );
});

test("bulk CSV processing returns a blocked result and performs no candidate insert", async () => {
  const originalParseCsv = cvParserService.parseCsv;
  const originalFindPotentialMatches = candidateStoreService.findPotentialMatches;
  const originalAddActiveCandidateIfUnique = candidateStoreService.addActiveCandidateIfUnique;
  let insertCalls = 0;

  cvParserService.parseCsv = async () => [parsedCandidate];
  candidateStoreService.findPotentialMatches = async () => [storedCandidate];
  candidateStoreService.addActiveCandidateIfUnique = async () => {
    insertCalls += 1;
    return { candidate: null, matches: [storedCandidate] };
  };

  try {
    const service = new BulkUploadService();
    const response = await service.processFiles(
      [
        {
          originalname: "candidates.csv",
          mimetype: "text/csv",
          size: 100,
          buffer: Buffer.from("name,email\nDuplicate Candidate,candidate@example.com")
        } as Express.Multer.File
      ],
      { id: "recruiter-1", name: "Recruiter One", email: "recruiter@agodly.com" }
    );

    assert.equal(insertCalls, 0);
    assert.equal(response.addedCandidates.length, 0);
    assert.equal(response.duplicates.length, 0);
    assert.equal(response.blockedDuplicates.length, 1);
    assert.equal(response.summary.duplicateCandidates, 1);
    assert.deepEqual(response.results[0], {
      fileName: "candidates.csv",
      kind: "CSV",
      status: "Blocked",
      added: 0,
      blocked: 1,
      message: "Parsed 1 row(s): 0 added, 1 blocked because the email or phone already exists"
    });
  } finally {
    cvParserService.parseCsv = originalParseCsv;
    candidateStoreService.findPotentialMatches = originalFindPotentialMatches;
    candidateStoreService.addActiveCandidateIfUnique = originalAddActiveCandidateIfUnique;
  }
});

test("bulk upload blocks duplicates without creating pending database records or orphan resumes", async () => {
  const root = process.cwd();
  const bulkService = await readFile(path.join(root, "lib/server/services/bulk-upload.service.ts"), "utf8");
  const candidateStore = await readFile(path.join(root, "lib/server/services/candidate-store.service.ts"), "utf8");
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.doesNotMatch(bulkService, /candidateStoreService\.addDuplicateCandidate/);
  assert.match(bulkService, /candidateStoreService\.addActiveCandidateIfUnique/);
  assert.match(bulkService, /status: addedForFile === 0 && duplicateForFile > 0 \? "Blocked"/);
  assert.match(bulkService, /await this\.removeStoredResume\(originalResume\)/);
  assert.match(candidateStore, /private uniqueAddQueue: Promise<void>/);
  assert.match(browser, /Blocked Duplicate Uploads/);
  assert.match(browser, /email address or phone number already exists in the database/);
});
