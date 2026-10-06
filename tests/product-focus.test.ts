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

test("finance edits are explicit and survive a background state refresh until saved", async () => {
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.doesNotMatch(browser, /value="\$\{escapeHtml\(row\.projectStartDate \|\| row\.date\)\}"/);
  assert.doesNotMatch(browser, /placement\?\.projectStartDate \|\| placement\?\.startDate \|\| placement\?\.date/);
  assert.match(browser, /const financeEditDrafts = new Map\(\)/);
  assert.match(browser, /setFinanceEditDraftValue\(event\.target\.dataset\.candidateId, event\.target\.dataset\.financeField, event\.target\.value\)/);
  assert.match(browser, /hasFinanceEditDrafts\(\)/);
  assert.match(browser, /clearFinanceEditDraft\(candidate\.id\)/);
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
  assert.match(browser, /Only the CEO and Managing Director can update revenue or margin/);
  assert.match(browser, /canViewFinance \? metricCard\("Total Revenue"/);
});

test("finance ledger recognises recurring C2C revenue by month and one-time FTE revenue", async () => {
  const [browser, authorization] = await Promise.all([
    readFile(path.join(root, "app.js"), "utf8"),
    readFile(path.join(root, "lib/server/services/authorization.service.ts"), "utf8")
  ]);

  assert.match(browser, /function buildFinanceLedger\(\)/);
  assert.match(browser, /getFinanceMonthsBetween\(shared\.startDate, actualEnd\)/);
  assert.match(browser, /oneTimeRevenue/);
  assert.match(browser, /monthlyRevenue/);
  assert.match(browser, /rateHistory/);
  assert.match(browser, /finance-period-filter/);
  assert.match(browser, /finance-client-filter/);
  assert.match(browser, /finance-recruiter-filter/);
  assert.match(browser, /finance-candidate-filter/);
  assert.match(browser, /Candidate & Contract Ledger/);
  assert.match(browser, /Client Revenue Contribution/);
  assert.match(authorization, /monthlyRevenue/);
  assert.match(authorization, /rateHistory/);
});
