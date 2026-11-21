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

test("the browser shell uses verified external parsing libraries and strict security headers", async () => {
  const [page, config] = await Promise.all([
    readFile(path.join(root, "app/page.tsx"), "utf8"),
    readFile(path.join(root, "next.config.ts"), "utf8")
  ]);

  assert.match(page, /integrity="sha384-uLiAv4VcjM5H2Jsqzl8EajEaxPugj1CIzQaCjQ8c5\/\/vC\+elhxO5pZfXGxoLQi1W"/);
  assert.match(page, /integrity="sha384-nFoSjZIoH3CCp8W639jJyQkuPHinJ2NHe7on1xvlUA7SuGfJAfvMldrsoAVm6ECz"/);
  assert.match(config, /"form-action 'self'"/);
  assert.match(config, /"upgrade-insecure-requests"/);
  assert.match(config, /Strict-Transport-Security/);
  assert.match(config, /Permissions-Policy/);
});

test("contractual onboarding retains project dates and rolls actual finance up by TA", async () => {
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.match(browser, /isContractual \? "projectStartDate" : "recognitionDate"/);
  assert.match(browser, /data-finance-field="billingStatus"/);
  assert.match(browser, /data-finance-field="billableStartDate"/);
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

test("onboarded finance uses readable grouped editor cards instead of a compressed table", async () => {
  const [browser, styles] = await Promise.all([
    readFile(path.join(root, "app.js"), "utf8"),
    readFile(path.join(root, "styles.css"), "utf8")
  ]);

  assert.match(browser, /class="finance-editor-list"/);
  assert.match(browser, /class="finance-editor-card"/);
  assert.match(browser, /class="finance-editor-fields"/);
  assert.match(browser, /class="finance-editor-margin"/);
  assert.match(browser, /Save finance/);
  assert.match(styles, /\.finance-editor-fields \{/);
  assert.match(styles, /grid-template-columns: repeat\(auto-fit, minmax\(145px, 1fr\)\)/);
});

test("deleted candidates cannot contribute to revenue, and permanent erasure removes their linked data", async () => {
  const [browser, route, controller, appState, candidateStore, audit] = await Promise.all([
    readFile(path.join(root, "app.js"), "utf8"),
    readFile(path.join(root, "app/api/candidates/[id]/route.ts"), "utf8"),
    readFile(path.join(root, "lib/server/controllers/candidate.controller.ts"), "utf8"),
    readFile(path.join(root, "lib/server/services/app-state-store.service.ts"), "utf8"),
    readFile(path.join(root, "lib/server/services/candidate-store.service.ts"), "utf8"),
    readFile(path.join(root, "lib/server/services/candidate-decision-audit.service.ts"), "utf8")
  ]);

  assert.match(browser, /state\.placements\.filter\(isPlacementLinkedToActiveCandidate\)\.flatMap/);
  assert.match(browser, /function isPlacementLinkedToActiveCandidate\(placement\)/);
  assert.match(browser, /data-action="permanently-delete-candidate"/);
  assert.match(browser, /Type the exact candidate name to permanently erase this record/);
  assert.match(route, /export const DELETE = handle\(permanentlyDeleteCandidate, \{ auth: true \}\)/);
  assert.match(controller, /Only the CEO or Managing Director can permanently erase candidate data/);
  assert.match(controller, /removeCandidateReferences\(candidateId\)/);
  assert.match(controller, /permanentlyDeleteForCandidate\(candidateId\)/);
  assert.match(candidateStore, /Move the candidate to Deleted Candidates before permanently erasing it/);
  assert.match(appState, /async removeCandidateReferences\(candidateId: string\)/);
  assert.match(audit, /async permanentlyDeleteForCandidate\(candidateId: string\)/);
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

test("CEO and Managing Director can edit every onboarded finance row", async () => {
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.match(browser, /const editable = canCurrentUserAccessExecutiveFinance\(\);/);
  assert.match(browser, /\$\{renderOnboardedRevenueTracker\(\)\}/);
  assert.doesNotMatch(browser, /You can update only your own onboarded revenue/);
  assert.doesNotMatch(browser, /You can update only your own contractual workdays/);
  assert.match(browser, /Only the CEO and Managing Director can update revenue or margin/);
  assert.match(browser, /Only the CEO and Managing Director can update contractual workdays/);
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

test("operating finance separates the current month from closed and historical contracts", async () => {
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.match(browser, /period: "current-month"/);
  assert.match(browser, /function isFinanceEntryInPeriod/);
  assert.match(browser, /if \(period === "previous-month"\)/);
  assert.match(browser, /if \(period === "current-quarter"\)/);
  assert.match(browser, /if \(period === "previous-quarter"\)/);
  assert.match(browser, /if \(!isContractBillingEnabled\(placement, asOf\) \|\| startDate > asOf\) return "Scheduled"/);
  assert.match(browser, /if \(!shared\.startDate \|\| shared\.startDate > now\) return \[\]/);
  assert.match(browser, /Projected Period Close/);
  assert.match(browser, /Month-End Forecast Revenue/);
  assert.match(browser, /Previous Quarter Margin/);
  assert.match(browser, /closed contracts are historical only/);
});

test("contractual finance prorates monthly rates by actual worked weekdays without a holiday calendar", async () => {
  const [browser, authorization] = await Promise.all([
    readFile(path.join(root, "app.js"), "utf8"),
    readFile(path.join(root, "lib/server/services/authorization.service.ts"), "utf8")
  ]);

  assert.match(browser, /function countFinanceWeekdays/);
  assert.match(browser, /function getContractWorkdayContext/);
  assert.match(browser, /actualWorkedDaysByMonth/);
  assert.match(browser, /dailyRevenue \* workdays\.actualWorkedDays/);
  assert.match(browser, /C2C actual workdays/);
  assert.match(browser, /No holiday calendar is maintained/);
  assert.match(browser, /Actual C2C workdays saved/);
  assert.match(authorization, /actualWorkedDaysByMonth/);
});

test("contractual finance only accrues after billing is activated and retains closed-contract history", async () => {
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.match(browser, /function getPlacementBillingStatusValue/);
  assert.match(browser, /function isContractBillingEnabled/);
  assert.match(browser, /savedStatus === "Not Started"/);
  assert.match(browser, /billingEnabled, isOnboarded: candidate\?\.stage === "Onboarded"/);
  assert.match(browser, /if \(!shared\.isOnboarded \|\| \(engagementType === "Contractual" && !shared\.billingEnabled\)\) return \[\]/);
  assert.match(browser, /Only Active Onboarded C2C placements are included in calculated totals/);
  assert.match(browser, /Scheduled Onboarding/);
  assert.match(browser, /if \(endDate && endDate < asOf\) return "Contract Closed"/);
});

test("executive finance projects the current C2C month from the recorded billable-day run rate", async () => {
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.match(browser, /function getContractMonthlyRunRate/);
  assert.match(browser, /function getMonthlyRunRateForecast/);
  assert.match(browser, /actualWorkedDays \* \(eligibleWorkingDays \/ elapsedEligibleWorkingDays\)/);
  assert.match(browser, /Projected Monthly Revenue, Cost & Margin/);
  assert.match(browser, /Projected Monthly Revenue/);
  assert.match(browser, /Projected Monthly Delivery Cost/);
  assert.match(browser, /Projected Monthly Margin/);
  assert.match(browser, /FTE and closed-contract amounts stay actual/);
});

test("executive finance forecasts next periods and year-end from active C2C run rate", async () => {
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.match(browser, /function getFinanceForecast\(finance, asOf = getFinanceTodayISO\(\)\)/);
  assert.match(browser, /function getC2CFutureMonthForecast/);
  assert.match(browser, /function getNextFinanceQuarterKey/);
  assert.match(browser, /Run-rate Forecast to/);
  assert.match(browser, /Forecast Revenue/);
  assert.match(browser, /Expected Revenue/);
  assert.match(browser, /Contracts with an end date stop on that date/);
  assert.match(browser, /open-ended contract/);
  assert.match(browser, /\$\{renderFinancialYearForecast\(finance\)\}/);
});

test("executive finance leads with projected month, quarter, and FY close totals", async () => {
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.match(browser, /function renderProjectedPeriodClose/);
  assert.match(browser, /Quarter-End Forecast Cost/);
  assert.match(browser, /FY-End Forecast Margin/);
  assert.match(browser, /contract that begins mid-month, calculations start on its saved project start date/);
  assert.match(browser, /getFinancePlacementScopeRows/);
  assert.match(browser, /contractStatus === "Scheduled"/);
  assert.match(browser, /Expected cost/);
});

test("executive finance omits salary cash planning and states the April–March financial year", async () => {
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.doesNotMatch(browser, /function getMonthEndDeliveryCostForecast/);
  assert.doesNotMatch(browser, /renderDeliveryCostCashForecast/);
  assert.doesNotMatch(browser, /Salary cash planning/);
  assert.match(browser, /financialYearStart = date\.month >= 4 \? date\.year : date\.year - 1/);
  assert.match(browser, /The financial year runs 1 April to 31 March; January–March is Q4/);
});

test("revenue charts present the most recent month and quarter first", async () => {
  const browser = await readFile(path.join(root, "app.js"), "utf8");

  assert.match(browser, /const monthsNewestFirst = \[\.\.\.finance\.months\]\.reverse\(\)/);
  assert.match(browser, /const quartersNewestFirst = \[\.\.\.finance\.quarters\]\.reverse\(\)/);
  assert.match(browser, /Recognised revenue by month · newest first/);
  assert.match(browser, /Recognised revenue by financial quarter · newest first/);
});
