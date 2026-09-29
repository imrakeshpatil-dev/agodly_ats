import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();

test("the ATS removes internal messaging and browser push endpoints", async () => {
  const removedPaths = [
    "app/api/messages",
    "app/api/push",
    "lib/server/services/messaging.service.ts",
    "lib/server/services/push-notification.service.ts",
    "public/sw.js"
  ];

  for (const file of removedPaths) {
    await assert.rejects(access(path.join(root, file)));
  }
});

test("AI shortlisting is available from the job workflow, not standalone navigation", async () => {
  const [html, browser] = await Promise.all([
    readFile(path.join(root, "index.html"), "utf8"),
    readFile(path.join(root, "app.js"), "utf8")
  ]);

  assert.doesNotMatch(html, /data-section="ai-match"|data-section="messages"/);
  assert.match(browser, /data-action="run-job-ai-shortlist"/);
  assert.match(browser, /Best-fit candidates for/);
});

test("contractual onboarding retains project dates and rolls actual finance up by TA", async () => {
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.match(browser, /data-finance-field="projectStartDate"/);
  assert.match(browser, /data-finance-field="projectEndDate"/);
  assert.match(browser, /A contractual placement needs its project start date/);
  assert.match(browser, /Project end date cannot be earlier than the start date/);
  assert.match(browser, /getContractualRevenueByTa/);
  assert.match(browser, /Contractual project totals/);
  assert.match(browser, /getPlacementRecognitionDate/);
  assert.match(browser, /data-finance-field="clientId"/);
  assert.match(browser, /Assign a valid client before saving deployed candidate finance/);
  assert.match(browser, /Deployment Client/);
  assert.match(browser, /Candidate onboarded with client assignment and synced/);
  assert.match(browser, /Client created and synced/);
  assert.match(browser, /projectStartDate: String\(item\.projectStartDate \|\| item\.startDate \|\| ""\)/);
  assert.match(browser, /projectEndDate: String\(item\.projectEndDate \|\| item\.endDate \|\| ""\)/);
});

test("executive finance shows QoQ and YoY business charts only to CEO and Managing Director", async () => {
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.match(browser, /function canCurrentUserAccessExecutiveFinance\(\)/);
  assert.match(browser, /role === "CEO" \|\| role === "Managing Director"/);
  assert.match(browser, /Executive Business Growth/);
  assert.match(browser, /Revenue QoQ/);
  assert.match(browser, /Revenue YoY/);
  assert.match(browser, /Quarterly Revenue/);
  assert.match(browser, /Quarterly Margin/);
  assert.match(browser, /TA Revenue Contribution/);
  assert.match(browser, /Client Revenue Contribution/);
  assert.match(browser, /Unassigned client — action required/);
  assert.match(browser, /revenueShare/);
  assert.match(browser, /No client contribution data available/);
  assert.match(browser, /Contract Project Health/);
});
