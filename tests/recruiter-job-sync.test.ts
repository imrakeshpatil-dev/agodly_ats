import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  canSyncAppState,
  scopeAppStatePayloadForRole
} from "../lib/server/services/app-state-access.service";
import { mergeBulkUploadSnapshots } from "../lib/server/services/app-state-store.service";
import { mergeRowsByIdentity } from "../lib/server/utils/record-merge";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

const fullPayload = {
  bulkUpload: { completed: 4 },
  users: [{ id: "usr-1", role: "CEO" }],
  clients: [{ id: "client-1", name: "Client" }],
  jobs: [{ id: "job-1", title: "Engineer" }],
  interviews: [{ id: "interview-1" }],
  placements: [{ id: "placement-1" }],
  activities: [{ id: "activity-1" }]
};

test("authenticated recruiters can load shared ATS state", async () => {
  const route = await read("app/api/bootstrap/route.ts");
  assert.match(route, /auth: true/);
  assert.doesNotMatch(route, /founder: true/);
});

test("recruiter sync is limited to recruiting collections", () => {
  const scoped = scopeAppStatePayloadForRole(fullPayload, "Recruiter");
  assert.deepEqual(Object.keys(scoped).sort(), ["activities", "interviews", "jobs", "placements"]);
  assert.equal(scoped.users, undefined);
  assert.equal(scoped.clients, undefined);
  assert.equal(scoped.bulkUpload, undefined);
});

test("recruiter bulk upload history is stored in an isolated user bucket", async () => {
  const controller = await read("lib/server/controllers/bootstrap.controller.ts");
  const bulkUploadController = await read("lib/server/controllers/bulk-upload.controller.ts");
  const candidateController = await read("lib/server/controllers/candidate.controller.ts");
  const browser = await read("app.js");

  assert.match(controller, /updateBulkUploadForUser\(authUser\.id, requestedBulkUpload\)/);
  assert.match(controller, /bulkUploadOwnerId: founder \? undefined : authUser\.id/);
  assert.match(controller, /isCandidateAssignedToUser\(authUser, candidate\)/);
  assert.match(controller, /includeOwnedUploadCandidates/);
  assert.match(bulkUploadController, /recordBulkUploadForUser\(authUser\.id/);
  assert.match(browser, /const recruiterSections = new Set\(\[[\s\S]*?"bulk-upload"/);
  assert.match(candidateController, /duplicates\.filter\(\(group\) => isCandidateAssignedToUser\(authUser, group\.duplicateCandidate\)\)/);
  assert.match(candidateController, /assertCanMutateCandidate\(req, duplicateCandidate\)/);
});

test("founder upload history aggregates recruiter buckets without duplicate candidate notes", () => {
  const merged = mergeBulkUploadSnapshots([
    {
      totalFiles: 1,
      completed: 1,
      lastRunAt: "2026-08-14T08:00:00.000Z",
      results: [{ fileName: "recruiter-one.csv", message: "1 added" }],
      candidateNotes: [{ id: "candidate-1", name: "Candidate One" }]
    },
    {
      totalFiles: 2,
      completed: 2,
      lastRunAt: "2026-08-14T09:00:00.000Z",
      results: [{ fileName: "recruiter-two.csv", message: "2 added" }],
      candidateNotes: [
        { id: "candidate-1", name: "Candidate One" },
        { id: "candidate-2", name: "Candidate Two" }
      ]
    }
  ]);

  assert.equal(merged.totalFiles, 3);
  assert.equal(merged.completed, 3);
  assert.equal(merged.lastRunAt, "2026-08-14T09:00:00.000Z");
  assert.equal((merged.results as unknown[]).length, 2);
  assert.equal((merged.candidateNotes as unknown[]).length, 2);
});

test("TA managers can sync clients while founders retain full access", () => {
  const manager = scopeAppStatePayloadForRole(fullPayload, "TA Manager");
  assert.deepEqual(Object.keys(manager).sort(), ["activities", "clients", "interviews", "jobs", "placements"]);

  const founder = scopeAppStatePayloadForRole(fullPayload, "Managing Director");
  assert.deepEqual(founder, fullPayload);
});

test("viewer accounts remain read-only", () => {
  assert.equal(canSyncAppState("Viewer"), false);
  assert.equal(canSyncAppState("Recruiter"), true);
});

test("an older recruiter snapshot cannot overwrite a newer job update", () => {
  const current = [{
    id: "job-1",
    title: "Current title",
    openings: 3,
    updatedAt: "2026-08-14T08:30:00.000Z"
  }];
  const stale = [{
    id: "job-1",
    title: "Stale title",
    openings: 1,
    updatedAt: "2026-08-14T08:00:00.000Z"
  }];

  assert.deepEqual(
    mergeRowsByIdentity(stale, current, { preferNewestUpdatedAt: true }),
    current
  );
});

test("a newer job update wins and retains fields omitted by the editor", () => {
  const current = [{
    id: "job-1",
    title: "Old title",
    clientId: "client-1",
    updatedAt: "2026-08-14T08:00:00.000Z"
  }];
  const incoming = [{
    id: "job-1",
    title: "Updated title",
    updatedAt: "2026-08-14T08:30:00.000Z"
  }];

  assert.deepEqual(
    mergeRowsByIdentity(incoming, current, { preferNewestUpdatedAt: true }),
    [{
      id: "job-1",
      title: "Updated title",
      clientId: "client-1",
      updatedAt: "2026-08-14T08:30:00.000Z"
    }]
  );
});

test("the browser refreshes shared state and versions job edits", async () => {
  const browser = await read("app.js");
  assert.match(browser, /SHARED_STATE_REFRESH_INTERVAL_MS = 15_000/);
  assert.match(browser, /visibilitychange/);
  assert.match(browser, /refreshSharedStateFromBackendIfIdle/);
  assert.match(browser, /updatedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(browser, /updatedAt: String\(item\.updatedAt \|\| ""\)/);
  assert.match(browser, /Only founders and TA Managers can create clients/);
});
