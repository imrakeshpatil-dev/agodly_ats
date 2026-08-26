import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  addFounderReviewRequest,
  completeFounderReview,
  getFounderReviewRequests,
  isFounderReviewStage
} from "../lib/server/services/founder-review.service";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");
const recruiter = { id: "usr-recruiter", name: "Recruiter One", email: "recruiter@agodly.com", role: "Recruiter" };
const founder = { id: "usr-ceo", name: "CEO User", email: "ceo@agodly.com", role: "CEO" };

test("submitted and later progress stages require founder review", () => {
  assert.equal(isFounderReviewStage("Qualified"), false);
  assert.equal(isFounderReviewStage("Submitted"), true);
  assert.equal(isFounderReviewStage("Client Review"), true);
  assert.equal(isFounderReviewStage("Interview"), true);
  assert.equal(isFounderReviewStage("Offer"), true);
  assert.equal(isFounderReviewStage("Onboarded"), true);
  assert.equal(isFounderReviewStage("On Hold"), false);
});

test("stage movement creates one durable pending review and prevents retry duplicates", () => {
  const first = addFounderReviewRequest(
    { tracking: { submittedAt: "2026-08-26" }, customValue: "preserve-me" },
    {
      candidateId: "candidate-1",
      stage: "Submitted",
      previousStage: "Qualified",
      actor: recruiter,
      requestedAt: "2026-08-26T08:00:00.000Z",
      reviewId: "review-1"
    }
  );
  const retried = addFounderReviewRequest(first, {
    candidateId: "candidate-1",
    stage: "Submitted",
    previousStage: "Qualified",
    actor: recruiter,
    requestedAt: "2026-08-26T08:01:00.000Z",
    reviewId: "review-duplicate"
  });
  const requests = getFounderReviewRequests(retried);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].id, "review-1");
  assert.equal(requests[0].status, "PENDING");
  assert.equal(retried.customValue, "preserve-me");
  assert.equal((retried.tracking as Record<string, unknown>).submittedAt, "2026-08-26");
  assert.equal((retried.timeline as Array<Record<string, unknown>>)[0].eventType, "Founder rating requested");
});

test("CEO or MD completion records the rating, reviewer, tracking value, and timeline", () => {
  const requested = addFounderReviewRequest({}, {
    candidateId: "candidate-1",
    stage: "Interview",
    previousStage: "Client Review",
    actor: recruiter,
    requestedAt: "2026-08-26T08:00:00.000Z",
    reviewId: "review-1"
  });
  const result = completeFounderReview(requested, {
    reviewId: "review-1",
    rating: 8.5,
    notes: "Strong client feedback",
    actor: founder,
    reviewedAt: "2026-08-26T09:00:00.000Z"
  });

  assert.ok(result.review);
  assert.equal(result.review?.status, "COMPLETED");
  assert.equal(result.review?.rating, 8.5);
  assert.equal(result.review?.reviewedBy?.role, "CEO");
  assert.equal((result.parsedData.tracking as Record<string, unknown>).overallRating, 8.5);
  assert.equal((result.parsedData.timeline as Array<Record<string, unknown>>)[0].eventType, "Founder rating completed");
});

test("notification endpoint is authenticated and only CEO or Managing Director can submit ratings", async () => {
  const [route, controller, browser, html, styles] = await Promise.all([
    read("app/api/candidates/[id]/founder-review/route.ts"),
    read("lib/server/controllers/candidate.controller.ts"),
    read("app.js"),
    read("index.html"),
    read("styles.css")
  ]);

  assert.match(route, /auth: true/);
  assert.match(controller, /authUser\.role !== "CEO" && authUser\.role !== "Managing Director"/);
  assert.match(controller, /Candidate rating must be between 1 and 10/);
  assert.match(browser, /data-notification-action="submit-rating"/);
  assert.match(browser, /Only the CEO or Managing Director can submit candidate ratings/);
  assert.match(html, /id="notificationCenter"/);
  assert.match(styles, /\.notification-panel/);
});

test("background refresh preserves window, table, profile, and pipeline scroll positions", async () => {
  const browser = await read("app.js");

  assert.match(browser, /function captureWorkspaceScrollState\(\)/);
  assert.match(browser, /"\.table-wrap", "\.candidate-side-panel", "\.pipeline-board", "\.pipeline-col"/);
  assert.match(browser, /render\(\{ preserveScroll: background \}\)/);
  assert.match(browser, /render\(\{ preserveScroll: true \}\)/);
  assert.match(browser, /restoreWorkspaceScrollState\(scrollSnapshot\)/);
});
