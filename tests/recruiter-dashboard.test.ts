import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

test("recruiter dashboard renders personal monthly targets instead of the founder tracker", async () => {
  const browser = await read("app.js");

  assert.match(browser, /isFounder \? renderTargetAchievementTracker\(\) : renderRecruiterDashboardPerformance\(\)/);
  assert.match(browser, /My Monthly Performance/);
  assert.match(browser, /Target progress &amp; leaderboard standing/);
  assert.match(browser, /currentMonthOnly: true/);
  assert.match(browser, /Candidate Target/);
  assert.match(browser, /Revenue Target/);
  assert.match(browser, /Leaderboard Rank/);
});

test("personal leaderboard shows the recruiter and nearby standings", async () => {
  const browser = await read("app.js");

  assert.match(browser, /Rank #\$\{rank\} of \$\{ranked\.length\}/);
  assert.match(browser, /nearbyRows = ranked\.slice/);
  assert.match(browser, /leaderboard-self/);
  assert.match(browser, />You</);
  assert.match(browser, /rankRecruiterPerformanceRows/);
  assert.match(browser, /Current-month standing using the same score and target calculations/);
});

test("leaderboard canonicalizes recruiter identity and excludes system upload buckets", async () => {
  const browser = await read("app.js");

  assert.match(browser, /usersByIdentity/);
  assert.match(browser, /canonicalIdentity = user\?\.id/);
  assert.match(browser, /participant\.aliases\.add/);
  assert.match(browser, /\["bulk upload", "unassigned", "unknown user", "system"\]/);
});

test("recruiter dashboard has visual treatment for the current standing", async () => {
  const styles = await read("styles.css");

  assert.match(styles, /\.recruiter-progress-grid/);
  assert.match(styles, /\.recruiter-target-progress/);
  assert.match(styles, /tbody tr\.leaderboard-self td/);
});
