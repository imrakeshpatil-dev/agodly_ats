import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

test("workspace density is accessible, persisted, and defaults to comfortable", async () => {
  const [html, browser, styles] = await Promise.all([
    read("index.html"),
    read("app.js"),
    read("styles.css")
  ]);

  assert.match(html, /id="densityControl" aria-label="Workspace density"/);
  assert.match(html, /value="comfortable">Comfortable view/);
  assert.match(html, /value="compact">Compact view/);
  assert.match(browser, /const UI_DENSITY_KEY = "agodly_ats_ui_density_v1"/);
  assert.match(browser, /applyWorkspaceDensity\(localStorage\.getItem\(UI_DENSITY_KEY\)\)/);
  assert.match(browser, /document\.documentElement\.dataset\.density = density/);
  assert.match(styles, /html\[data-density="compact"\]/);
});

test("visual polish keeps the candidate list full width and opens the profile as a drawer", async () => {
  const styles = await read("styles.css");

  assert.match(styles, /\.candidates-layout\.has-profile\s*{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.candidate-side-panel\s*{[\s\S]*?position: fixed/);
  assert.match(styles, /width: min\(600px, calc\(100vw - 2rem\)\)/);
});

test("visual polish defines consistent controls, table rhythm, typography, and mobile fitting", async () => {
  const styles = await read("styles.css");

  assert.match(styles, /--control-height: 40px/);
  assert.match(styles, /--row-padding-y: 0\.7rem/);
  assert.match(styles, /text-rendering: optimizeLegibility/);
  assert.match(styles, /\.candidate-table\s*{\s*min-width: 1320px/);
  assert.match(styles, /@media \(min-width: 781px\) and \(max-width: 1360px\)[\s\S]*?\.candidate-table\s*{\s*min-width: 1080px/);
  assert.match(styles, /\.candidate-table th:nth-child\(11\)[\s\S]*?display: none/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?\.toolbar h1\s*{\s*font-size: 1\.45rem/);
});
