import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  downloadCandidateResume,
  getCandidate,
  listCandidates,
  updateCandidateProfile
} from "../lib/server/controllers/candidate.controller";
import { AppError } from "../lib/server/middleware/error.middleware";
import { AIMemoryService } from "../lib/server/services/aiMemory.service";
import { authorizationService, type AuthorizationContext } from "../lib/server/services/authorization.service";
import { candidateStoreService } from "../lib/server/services/candidate-store.service";
import { searchCandidates, summarizeCandidate } from "../lib/server/services/aiTools";
import type { AppStateSnapshot, AppStateStorePayload } from "../lib/server/types/app-state";
import type { CandidateRecord } from "../lib/server/types/candidate";

const recruiterA = context("Recruiter", "usr-a", ["usr-a"], ["recruiter a", "a@agodly.com"]);
const recruiterB = context("Recruiter", "usr-b", ["usr-b"], ["recruiter b", "b@agodly.com"]);
const manager = context("TA Manager", "usr-manager", ["usr-manager", "usr-a", "usr-b"], [
  "manager",
  "manager@agodly.com",
  "recruiter a",
  "a@agodly.com",
  "recruiter b",
  "b@agodly.com"
]);
const admin = context("Admin", "usr-admin", ["usr-admin"], ["admin", "admin@agodly.com"]);

const candidateA = candidate("candidate-a", "usr-a", "Recruiter A", "a-candidate@example.com");
const candidateB = candidate("candidate-b", "usr-b", "Recruiter B", "b-candidate@example.com");

test("candidate read and edit permissions isolate recruiters while manager and admin retain scope", () => {
  assert.equal(authorizationService.canViewCandidate(recruiterA, candidateA), true);
  assert.equal(authorizationService.canEditCandidate(recruiterA, candidateA), true);
  assert.equal(authorizationService.canViewCandidate(recruiterA, candidateB), false);
  assert.equal(authorizationService.canEditCandidate(recruiterA, candidateB), false);
  assert.equal(authorizationService.canViewCandidate(recruiterB, candidateA), false);

  assert.deepEqual(
    authorizationService.scopeCandidates(manager, [candidateA, candidateB]).map((row) => row.id).sort(),
    ["candidate-a", "candidate-b"]
  );
  assert.deepEqual(
    authorizationService.scopeCandidates(admin, [candidateA, candidateB]).map((row) => row.id).sort(),
    ["candidate-a", "candidate-b"]
  );
});

test("bootstrap state cannot reveal another recruiter's candidates, jobs, clients, interviews, exports, or bulk history", () => {
  const snapshot: AppStateSnapshot = {
    bulkUpload: {
      candidateNotes: [candidateA, candidateB],
      blockedDuplicates: [{ name: "Duplicate", matchedCandidateIds: [candidateB.id] }]
    },
    users: [
      { id: "usr-a", name: "Recruiter A" },
      { id: "usr-b", name: "Recruiter B" }
    ],
    candidates: [candidateA, candidateB],
    jobs: [
      { id: "job-a", clientId: "client-a", assignedRecruiterId: "usr-a" },
      { id: "job-b", clientId: "client-b", assignedRecruiterId: "usr-b" }
    ],
    clients: [{ id: "client-a" }, { id: "client-b" }],
    interviews: [
      { id: "interview-a", candidateId: candidateA.id },
      { id: "interview-b", candidateId: candidateB.id }
    ],
    placements: [
      { id: "placement-a", candidateId: candidateA.id, revenue: 1000 },
      { id: "placement-b", candidateId: candidateB.id, revenue: 2000 }
    ],
    activities: [
      { id: "activity-a", candidateId: candidateA.id },
      { id: "activity-b", candidateId: candidateB.id }
    ]
  };

  const scoped = authorizationService.scopeAppState(recruiterA, snapshot);
  const serialized = JSON.stringify(scoped);
  assert.doesNotMatch(serialized, /candidate-b|job-b|client-b|interview-b|placement-b|activity-b|b-candidate@example\.com/);
  assert.match(serialized, /candidate-a/);
  assert.deepEqual((scoped.bulkUpload.blockedDuplicates as Array<Record<string, unknown>>)[0].matchedCandidateIds, []);
  assert.equal("revenue" in scoped.placements[0], false);
});

test("sync payload rejects cross-recruiter mutations and ownership reassignment", () => {
  const payload: AppStateStorePayload = {
    bulkUpload: { candidateNotes: [candidateB] },
    jobs: [
      { id: "job-a", assignedRecruiterId: "usr-a" },
      { id: "job-b", assignedRecruiterId: "usr-b" }
    ],
    interviews: [
      { id: "interview-a", candidateId: candidateA.id },
      { id: "interview-b", candidateId: candidateB.id }
    ],
    placements: [{ id: "placement-b", candidateId: candidateB.id }],
    activities: [
      { id: "activity-a", candidateId: candidateA.id },
      { id: "activity-b", candidateId: candidateB.id }
    ]
  };

  const scoped = authorizationService.scopeSyncPayload(recruiterA, payload, [candidateA]);
  assert.equal(scoped.bulkUpload, undefined);
  assert.deepEqual(scoped.jobs?.map((row) => row.id), ["job-a"]);
  assert.deepEqual(scoped.interviews?.map((row) => row.id), ["interview-a"]);
  assert.equal(scoped.placements, undefined);
  assert.deepEqual(scoped.activities?.map((row) => row.id), ["activity-a"]);
  assert.equal(authorizationService.canAssignCandidateOwner(recruiterA, "usr-b"), false);
  assert.equal(authorizationService.canAssignCandidateOwner(manager, "usr-b"), true);
});

test("candidate list, single-record, and update API controllers enforce scope and audit denied lookups", async () => {
  const originalCreateContext = authorizationService.createContext;
  const originalList = candidateStoreService.listCandidatesForContext;
  const originalSingle = candidateStoreService.getCandidateForContext;
  const originalAudit = authorizationService.logUnauthorizedAccess;
  const auditEvents: Array<Record<string, string>> = [];

  authorizationService.createContext = async () => recruiterA;
  candidateStoreService.listCandidatesForContext = async () => ({
    rows: [candidateA],
    page: 1,
    limit: 25,
    total: 1,
    totalPages: 1,
    statusCounts: { active: 1, deleted: 0 }
  });
  candidateStoreService.getCandidateForContext = async (_context, id) => id === candidateA.id ? candidateA : null;
  authorizationService.logUnauthorizedAccess = async (event) => {
    auditEvents.push(event);
  };

  try {
    let responseBody: unknown;
    const response = {
      status() { return this; },
      json(body: unknown) { responseBody = body; return this; }
    };
    const baseRequest = {
      authUser: recruiterA.user,
      query: {},
      body: {},
      params: {},
      originalUrl: "/api/candidates"
    };

    await listCandidates(baseRequest as never, response as never);
    assert.equal(JSON.stringify(responseBody).includes(candidateB.id), false);
    assert.equal(JSON.stringify(responseBody).includes(candidateA.id), true);

    await assert.rejects(
      () => getCandidate({ ...baseRequest, params: { id: candidateB.id } } as never, response as never),
      (error) => error instanceof AppError && error.statusCode === 404
    );
    await assert.rejects(
      () => updateCandidateProfile({
        ...baseRequest,
        body: { stage: "Screening" },
        params: { id: candidateB.id },
        originalUrl: `/api/candidates/${candidateB.id}`
      } as never, response as never),
      (error) => error instanceof AppError && error.statusCode === 404
    );
    await assert.rejects(
      () => downloadCandidateResume({
        ...baseRequest,
        params: { id: candidateB.id },
        originalUrl: `/api/candidates/${candidateB.id}/resume`
      } as never, response as never),
      (error) => error instanceof AppError && error.statusCode === 404
    );

    assert.deepEqual(auditEvents.map((event) => event.entityType), [
      "candidate-read",
      "candidate-update",
      "candidate-resume"
    ]);
    assert.equal(auditEvents.every((event) => event.entityId === candidateB.id), true);
  } finally {
    authorizationService.createContext = originalCreateContext;
    candidateStoreService.listCandidatesForContext = originalList;
    candidateStoreService.getCandidateForContext = originalSingle;
    authorizationService.logUnauthorizedAccess = originalAudit;
  }
});

test("MY LLM uses only scoped candidate queries and cannot summarize Recruiter B's candidate", async () => {
  const originalScopedActive = candidateStoreService.getActiveCandidatesForContext;
  const originalScopedSingle = candidateStoreService.getCandidateForContext;
  const originalUnscopedSingle = candidateStoreService.getCandidateById;
  const originalAudit = authorizationService.logUnauthorizedAccess;

  candidateStoreService.getActiveCandidatesForContext = async (receivedContext) => {
    assert.equal(receivedContext.user.id, "usr-a");
    return [candidateA];
  };
  candidateStoreService.getCandidateForContext = async (_receivedContext, id) => id === candidateA.id ? candidateA : null;
  candidateStoreService.getCandidateById = async () => {
    throw new Error("Unscoped candidate lookup must not be used by authenticated AI tools");
  };
  authorizationService.logUnauthorizedAccess = async () => undefined;

  try {
    const search = await searchCandidates({ query: "typescript", limit: 20 }, recruiterA);
    assert.deepEqual(search.results.map((row) => row.id), [candidateA.id]);
    await assert.rejects(() => summarizeCandidate(candidateB.id, recruiterA), /Candidate not found/);
  } finally {
    candidateStoreService.getActiveCandidatesForContext = originalScopedActive;
    candidateStoreService.getCandidateForContext = originalScopedSingle;
    candidateStoreService.getCandidateById = originalUnscopedSingle;
    authorizationService.logUnauthorizedAccess = originalAudit;
  }
});

test("AI conversations, memories, and feedback are isolated by owner", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "agodly-ai-memory-"));
  const service = new AIMemoryService(path.join(tempDir, "memory.json"));

  try {
    const conversationA = await service.getConversation("shared-browser-id", "usr-a");
    const conversationB = await service.getConversation("shared-browser-id", "usr-b");
    const interactionA = await service.recordInteraction({
      ownerUserId: "usr-a",
      prompt: "Find Candidate A",
      explanation: "Candidate A result",
      toolCalls: ["searchCandidates"],
      results: [{ id: candidateA.id }],
      conversationId: conversationA.id
    });
    await service.recordInteraction({
      ownerUserId: "usr-b",
      prompt: "Find Candidate B",
      explanation: "Candidate B result",
      toolCalls: ["searchCandidates"],
      results: [{ id: candidateB.id }],
      conversationId: conversationB.id
    });

    const memoriesA = await service.findRelevantMemories("Find Candidate", 10, "usr-a");
    assert.equal(memoriesA.length, 1);
    assert.equal(memoriesA[0].ownerUserId, "usr-a");
    await assert.rejects(
      () => service.applyFeedback({ interactionId: interactionA, ownerUserId: "usr-b", helpful: true }),
      /Interaction not found/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

function context(
  role: AuthorizationContext["user"]["role"],
  id: string,
  visibleUserIds: string[],
  aliases: string[]
): AuthorizationContext {
  return {
    user: { id, role, name: aliases[0], email: aliases[1] },
    visibleUserIds: new Set(visibleUserIds),
    visibleAliases: new Set(aliases)
  };
}

function candidate(id: string, ownerUserId: string, recruiter: string, email: string): CandidateRecord {
  return {
    id,
    ownerUserId,
    uploadedByUserId: ownerUserId,
    assignedRecruiterId: ownerUserId,
    name: id,
    email,
    phone: `+91-90000-${id.endsWith("a") ? "00001" : "00002"}`,
    recruiter,
    stage: "Identified",
    jobId: id.endsWith("a") ? "job-a" : "job-b",
    currentRole: "TypeScript Engineer",
    skills: ["TypeScript"],
    experienceYears: 5,
    profileSummary: `${id} private profile`,
    keywords: ["typescript"],
    location: "Pune",
    education: "B.Tech",
    currentCompany: "Private Company",
    resumeUrl: `data/resumes/${id}.pdf`,
    parsedData: { uploadedByUserId: ownerUserId },
    parsingStatus: "COMPLETED",
    source: "Manual Entry",
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:00.000Z",
    status: "ACTIVE",
    deletedAt: null,
    duplicateOf: [],
    mergedInto: null
  };
}
