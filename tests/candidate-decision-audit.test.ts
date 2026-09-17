import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { deriveCandidateDecisionAuditEvents } from "../lib/server/services/candidate-decision-audit.service";
import type { AuthUser } from "../lib/server/services/auth.service";
import type { CandidateRecord } from "../lib/server/types/candidate";

const root = process.cwd();

const candidate = (overrides: Partial<CandidateRecord> = {}): CandidateRecord => ({
  id: "candidate-1",
  ownerUserId: "owner-1",
  uploadedByUserId: "owner-1",
  assignedRecruiterId: "owner-1",
  name: "Asha Sharma",
  email: "asha@example.com",
  phone: "",
  recruiter: "Runa Das",
  stage: "Qualified",
  jobId: "job-1",
  currentRole: "Backend Engineer",
  skills: ["Node.js"],
  experienceYears: 6,
  profileSummary: "",
  keywords: [],
  location: "Pune",
  education: "",
  currentCompany: "",
  resumeUrl: "",
  parsedData: {
    tracking: { overallRating: 6, technicalRating: 6, communicationRating: 6 },
    shortlistDecisions: [],
    collaborationNotes: [],
    feedbackHistory: [],
    stageHistory: []
  },
  parsingStatus: "COMPLETED",
  source: "Manual",
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-01T09:00:00.000Z",
  status: "ACTIVE",
  duplicateOf: [],
  mergedInto: null,
  ...overrides
});

const actor: AuthUser = { id: "manager-1", name: "Maya Manager", email: "maya@agodly.com", role: "TA Manager" };

test("decision audit derives the required immutable decision categories from a candidate update", () => {
  const existing = candidate();
  const updated = candidate({
    ownerUserId: "owner-2",
    assignedRecruiterId: "owner-2",
    recruiter: "Nina Recruiter",
    stage: "Dropped",
    parsedData: {
      tracking: { overallRating: 8, technicalRating: 9, communicationRating: 7, ratingNotes: "Strong technical screen", trackingStatus: "Rejected", rejectionReason: "Role location changed" },
      shortlistDecisions: [{ id: "shortlist-1", jobId: "job-1", jobTitle: "Platform Engineer", decision: "Not a fit", note: "Location mismatch" }],
      collaborationNotes: [{ id: "note-1", text: "Client asked for a closer location match", mentions: ["Maya"] }],
      feedbackHistory: [{ id: "feedback-1", feedbackType: "Client", clientFeedback: "Location mismatch" }],
      stageHistory: [{ id: "stage-1", jobId: "job-1", reason: "Role location changed", source: "ATS" }]
    }
  });

  const events = deriveCandidateDecisionAuditEvents({
    existing,
    updated,
    patch: { stage: "Dropped", ownerUserId: "owner-2", assignedRecruiterId: "owner-2", recruiter: "Nina Recruiter", parsedData: updated.parsedData },
    actor
  });

  assert.deepEqual(
    new Set(events.map((event) => event.action)),
    new Set(["REJECTION", "OWNERSHIP_CHANGED", "RATING", "SHORTLIST_DECISION", "FEEDBACK"])
  );
  const rejection = events.find((event) => event.action === "REJECTION");
  assert.equal(rejection?.reason, "Role location changed");
  assert.deepEqual(rejection?.before, { stage: "Qualified", trackingStatus: null });
  assert.equal(rejection?.after?.stage, "Dropped");
  assert.equal(events.every((event) => event.actorId === actor.id && event.actorName === actor.name), true);
});

test("decision timeline is a read-only authenticated candidate route", async () => {
  const route = await readFile(path.join(root, "app/api/candidates/[id]/decision-timeline/route.ts"), "utf8");
  const controller = await readFile(path.join(root, "lib/server/controllers/candidate.controller.ts"), "utf8");
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.match(route, /export const GET = handle\(listCandidateDecisionTimeline, \{ auth: true \}\)/);
  assert.doesNotMatch(route, /export const (POST|PUT|PATCH|DELETE)/);
  assert.match(controller, /getCandidateOrDeny\(req, context, candidateId, "candidate-decision-timeline"\)/);
  assert.match(browser, /Immutable Decision Timeline/);
  assert.match(browser, /Server-recorded decisions cannot be edited/);
});
