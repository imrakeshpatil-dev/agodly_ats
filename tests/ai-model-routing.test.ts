import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { selectAIWorkloadTier } from "../lib/server/services/ai/aiWorkloadRouter";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

test("recruiter prompts route routine work to standard and difficult analysis to complex", () => {
  assert.equal(selectAIWorkloadTier("Draft a job description for a React developer"), "standard");
  assert.equal(selectAIWorkloadTier("Summarize candidate cand-123"), "standard");
  assert.equal(selectAIWorkloadTier("Match candidates to this Java job description"), "standard");
  assert.equal(selectAIWorkloadTier("Compare candidates A and B across role fit and risks"), "complex");
  assert.equal(selectAIWorkloadTier("Show historical hiring demand insights by role"), "complex");
  assert.equal(selectAIWorkloadTier("Create a detailed analysis across all jobs and clients"), "complex");
  assert.equal(selectAIWorkloadTier("x".repeat(4_000)), "complex");
});

test("AI call sites use the requested workload-specific providers", async () => {
  const [env, config, resume, tools, agent, render] = await Promise.all([
    read("lib/server/config/env.ts"),
    read("lib/server/services/ai/aiConfig.ts"),
    read("lib/server/services/resumeAIParser.ts"),
    read("lib/server/services/aiTools.ts"),
    read("lib/server/services/aiAgentService.ts"),
    read("render.yaml")
  ]);

  assert.match(env, /OPENAI_BULK_MODEL/);
  assert.match(env, /gpt-5\.6-luna/);
  assert.match(env, /gpt-5\.4-mini/);
  assert.match(env, /gpt-5\.6-terra/);
  assert.match(config, /workload === "bulk"/);
  assert.match(config, /workload === "complex"/);
  assert.match(resume, /getAIProvider\("bulk"\)/);
  assert.match(tools, /getAIProvider\("standard"\)/);
  assert.match(agent, /getAIProvider\(selectAIWorkloadTier\(cleanPrompt\)\)/);
  assert.match(render, /OPENAI_BULK_MODEL[\s\S]*gpt-5\.6-luna/);
  assert.match(render, /OPENAI_STANDARD_MODEL[\s\S]*gpt-5\.4-mini/);
  assert.match(render, /OPENAI_COMPLEX_MODEL[\s\S]*gpt-5\.6-terra/);
});
