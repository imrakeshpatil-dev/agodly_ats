import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { CandidateInput } from "../lib/server/types/candidate";
import { attributeCandidateToUploader } from "../lib/server/utils/bulk-upload-attribution";

const candidate: CandidateInput = {
  name: "Candidate One",
  email: "candidate@example.com",
  phone: "",
  recruiter: "Bulk Upload",
  stage: "Identified",
  jobId: "",
  currentRole: "Engineer",
  skills: ["TypeScript"],
  experienceYears: 5,
  profileSummary: "",
  keywords: ["typescript"],
  location: "Pune",
  education: "",
  currentCompany: "",
  source: "CSV Upload (candidates.csv)",
  parsedData: {
    parser: "HEURISTIC"
  }
};

test("bulk upload assigns every candidate to the authenticated uploader", () => {
  const attributed = attributeCandidateToUploader(
    candidate,
    {
      id: "usr-recruiter-1",
      name: "Sanjana Hanagal",
      email: "sanjana@agodly.com"
    },
    "2026-08-14T05:00:00.000Z"
  );

  assert.equal(attributed.recruiter, "Sanjana Hanagal");
  assert.equal(attributed.source, "CSV Upload (candidates.csv)");
  assert.deepEqual(attributed.parsedData, {
    parser: "HEURISTIC",
    uploadedBy: "Sanjana Hanagal",
    uploadedByUserId: "usr-recruiter-1",
    uploadedAt: "2026-08-14T05:00:00.000Z"
  });
});

test("CSV or parser recruiter values cannot override the authenticated uploader", () => {
  const attributed = attributeCandidateToUploader(
    { ...candidate, recruiter: "Someone Else" },
    {
      id: "usr-recruiter-2",
      name: "Runa Das",
      email: "runa@agodly.com"
    }
  );

  assert.equal(attributed.recruiter, "Runa Das");
});

test("uploader email is used when the account has no display name", () => {
  const attributed = attributeCandidateToUploader(candidate, {
    id: "usr-recruiter-3",
    name: "   ",
    email: "recruiter@agodly.com"
  });

  assert.equal(attributed.recruiter, "recruiter@agodly.com");
  assert.equal(attributed.parsedData?.uploadedBy, "recruiter@agodly.com");
});

test("bulk upload controller passes authenticated identity and blocks viewers", async () => {
  const root = process.cwd();
  const controller = await readFile(path.join(root, "lib/server/controllers/bulk-upload.controller.ts"), "utf8");
  const resumeController = await readFile(path.join(root, "lib/server/controllers/resumeController.ts"), "utf8");
  const resumeService = await readFile(path.join(root, "lib/server/services/resumeProcessingService.ts"), "utf8");
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.match(controller, /authUser\.role === "Viewer"/);
  assert.match(controller, /bulkUploadService\.processFiles\(files, \{/);
  assert.match(resumeController, /resumeProcessingService\.processUploadedResume\(file, \{/);
  assert.match(resumeService, /\.\.\.uploadAttribution/);
  assert.match(browser, /attributeLocalBulkUploadCandidate/);
  assert.match(browser, /recruiter: uploaderName/);
});
