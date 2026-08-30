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
