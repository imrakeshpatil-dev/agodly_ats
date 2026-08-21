import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  PIPELINE_STAGES,
  isPipelineStage,
  normalizePipelineStage
} from "../lib/server/constants/pipeline";

const projectRoot = process.cwd();

test("pipeline supports On Hold and Pool as valid persisted stages", () => {
  assert.deepEqual(PIPELINE_STAGES.slice(-3), ["On Hold", "Pool", "Dropped"]);
  assert.equal(isPipelineStage("On Hold"), true);
  assert.equal(isPipelineStage("Pool"), true);
  assert.equal(isPipelineStage("Not a Stage"), false);
  assert.equal(normalizePipelineStage("Pool"), "Pool");
  assert.equal(normalizePipelineStage("Not a Stage"), "Identified");
});

test("browser pipeline treats disposition stages separately from progress ranking", () => {
  const browser = fs.readFileSync(path.join(projectRoot, "app.js"), "utf8");

  assert.match(browser, /PIPELINE_DISPOSITION_STAGES = new Set\(\["On Hold", "Pool"\]\)/);
  assert.match(browser, /stage === "On Hold"\) return "On Hold"/);
  assert.match(browser, /stage === "Pool"\) return "Pool"/);
  assert.match(browser, /Use On Hold when the linked requirement is temporarily paused/);
  assert.match(browser, /Use Pool for a suitable candidate who is not attached to an active requirement/);
});

test("candidate page has responsive list, card, and profile-drawer styles", () => {
  const browser = fs.readFileSync(path.join(projectRoot, "app.js"), "utf8");
  const styles = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");

  assert.match(browser, /class="table-wrap candidate-table-wrap"/);
  assert.match(browser, /class="candidate-table"/);
  assert.match(browser, /data-label="Candidate"/);
  assert.match(styles, /\.candidate-side-panel:not\(\.candidate-side-empty\)/);
  assert.match(styles, /\.candidate-table \.candidate-row td::before/);
  assert.match(styles, /grid-template-columns: var\(--sidebar-width\) minmax\(0, 1fr\)/);
});

test("pipeline board supports visible and gesture-based horizontal navigation", () => {
  const browser = fs.readFileSync(path.join(projectRoot, "app.js"), "utf8");
  const styles = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");

  assert.match(browser, /data-action="pipeline-scroll" data-direction="left"/);
  assert.match(browser, /data-action="pipeline-scroll" data-direction="right"/);
  assert.match(browser, /function onSectionWheel\(event\)/);
  assert.match(browser, /function onSectionPointerDown\(event\)/);
  assert.match(browser, /tabindex="0" role="region" aria-label="Pipeline stages/);
  assert.match(styles, /\.pipeline-board\.is-dragging/);
  assert.match(styles, /touch-action: pan-x pan-y/);
  assert.match(styles, /\.pipeline-board::-webkit-scrollbar/);
});
