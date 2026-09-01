import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  assertJobStatusTransition,
  buildDemandInsights,
  normalizeJobInput,
  normalizeJobVisibilityScope,
  normalizeJobStatus
} from "../lib/server/services/job-domain";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

test("job status aliases and transitions preserve explicit lifecycle states", () => {
  assert.equal(normalizeJobStatus("Open"), "ACTIVE");
  assert.equal(normalizeJobStatus("On Hold"), "ON_HOLD");
  assert.equal(assertJobStatusTransition("ACTIVE", "PAUSED"), "PAUSED");
  assert.throws(() => assertJobStatusTransition("DRAFT", "FILLED"), /cannot move directly/i);
});

test("draft jobs may remain incomplete while publishing validates structured fields", () => {
  const draft = normalizeJobInput({ title: "Platform Engineer", status: "DRAFT" });
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.clientId, null);

  assert.throws(
    () => normalizeJobInput({ title: "Platform Engineer", status: "ACTIVE" }),
    /Client is required before publishing/i
  );

  const active = normalizeJobInput({
    title: "Platform Engineer",
    status: "ACTIVE",
    clientId: "client-1",
    requiredSkills: ["Kubernetes", "Terraform"],
    workMode: "Remote",
    remoteScope: "India",
    primaryTimeZone: "Asia/Kolkata",
    supportedTimeZones: ["Europe/London"],
    minTimeZoneOverlap: 4
  });
  assert.equal(active.workMode, "REMOTE");
  assert.equal(active.primaryTimeZone, "Asia/Kolkata");
  assert.deepEqual(active.supportedTimeZones, ["Europe/London"]);
});

test("job visibility defaults to the direct recruiting team and accepts organisation sharing", () => {
  assert.equal(normalizeJobVisibilityScope(undefined), "DIRECT_TEAM");
  assert.equal(normalizeJobVisibilityScope("organisation"), "ORGANIZATION");
  assert.equal(normalizeJobVisibilityScope("private"), "DIRECT_TEAM");
  assert.equal(normalizeJobVisibilityScope("ORGANIZATION"), "ORGANIZATION");

  const directTeam = normalizeJobInput({ title: "Platform Engineer", status: "DRAFT" });
  const organisation = normalizeJobInput({ title: "Platform Engineer", status: "DRAFT", visibilityScope: "ORGANIZATION" });
  assert.equal(directTeam.visibilityScope, "DIRECT_TEAM");
  assert.equal(organisation.visibilityScope, "ORGANIZATION");
});

test("historical demand insights are derived from recorded jobs and candidate supply", () => {
  const now = new Date("2026-08-24T00:00:00.000Z");
  const insights = buildDemandInsights(
    [
      { id: "job-1", title: "Salesforce Developer", requiredSkills: ["Salesforce", "Apex"], status: "CLOSED", openings: 2, createdAt: "2026-02-01T00:00:00.000Z", closedAt: "2026-03-01T00:00:00.000Z", locations: ["Pune"], primaryTimeZone: "Asia/Kolkata" },
      { id: "job-2", title: "Salesforce Engineer", requiredSkills: ["Salesforce", "Lightning"], status: "ACTIVE", openings: 3, createdAt: "2026-07-01T00:00:00.000Z", locations: ["Bengaluru"], primaryTimeZone: "Asia/Kolkata" }
    ],
    [{ id: "candidate-1", skills: ["Salesforce", "Apex"], status: "ACTIVE" }],
    now
  );

  assert.equal(insights[0].label, "Salesforce");
  assert.equal(insights[0].jobs12m, 2);
  assert.equal(insights[0].openings12m, 5);
  assert.equal(insights[0].availableCandidates, 1);
  assert.ok(Number(insights[0].supplyGap) > 0);
});

test("Jobs API routes require authentication and generic sync no longer owns jobs", async () => {
  const collectionRoute = await read("app/api/jobs/route.ts");
  const itemRoute = await read("app/api/jobs/[id]/route.ts");
  const bootstrap = await read("lib/server/controllers/bootstrap.controller.ts");
  const service = await read("lib/server/services/job.service.ts");

  assert.match(collectionRoute, /auth: true/);
  assert.match(itemRoute, /auth: true/);
  assert.match(bootstrap, /Jobs API owns job mutations/);
  assert.match(bootstrap, /jobs: undefined/);
  assert.match(service, /Founder access is required for permanent job deletion/);
  assert.match(service, /Permanent deletion is blocked/);
  assert.match(service, /getJobReferences/);
  assert.match(service, /LEGACY_IMPORTED/);
});

test("job migration is additive and the interface exposes structured controls", async () => {
  const migration = await read("prisma/migrations/20260824120000_secure_jobs_api/migration.sql");
  const browser = await read("app.js");

  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b|\bDELETE\s+FROM\b/i);
  assert.match(migration, /CREATE TABLE "JobAudit"/);
  assert.match(migration, /CREATE TABLE "CandidatePool"/);
  assert.match(browser, /Hiring Demand Insights/);
  assert.match(browser, /data-action="job-status-change"/);
  assert.match(browser, /data-action="archive-job"/);
  assert.match(browser, /data-action="delete-job-permanently"/);
  assert.match(browser, /Asia\/Kolkata/);
  assert.match(browser, /data-action="build-insight-candidate-pool"/);
});
