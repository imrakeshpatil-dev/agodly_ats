import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

test("MY LLM and AI Match use the configured provider abstraction", async () => {
  const [agent, tools] = await Promise.all([
    read("lib/server/services/aiAgentService.ts"),
    read("lib/server/services/aiTools.ts")
  ]);
  assert.match(agent, /getAIProvider\(\)/);
  assert.match(agent, /AI assistant is temporarily unavailable\. Core ATS functions continue to work normally\./);
  assert.match(tools, /rerankWithConfiguredProviderForJobMatch/);
  assert.match(tools, /heuristicRanked/);
  assert.doesNotMatch(agent, /new OpenAI|OPENAI_API_KEY/);
  assert.doesNotMatch(tools, /new OpenAI/);
});

test("existing authenticated AI and resume API contracts remain present", async () => {
  const [chat, match, resume, reparse] = await Promise.all([
    read("app/api/ai/chat/route.ts"),
    read("app/api/ai/match-score/route.ts"),
    read("app/api/resume/process/route.ts"),
    read("app/api/candidates/[id]/reparse-ai/route.ts")
  ]);
  assert.match(chat, /auth: true/);
  assert.match(match, /auth: true/);
  assert.match(resume, /process/);
  assert.match(reparse, /reparseCandidateWithAI/);
});

test("provider keys stay server-side and are absent from browser assets", async () => {
  const [browser, html] = await Promise.all([read("app.js"), read("index.html")]);
  for (const content of [browser, html]) {
    assert.doesNotMatch(content, /OPENAI_API_KEY|OPENROUTER_API_KEY|sk-[A-Za-z0-9]/);
  }
});
