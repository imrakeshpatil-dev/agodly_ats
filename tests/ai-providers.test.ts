import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { AIProviderConfig } from "../lib/server/services/ai/aiConfig";
import { AIProviderError } from "../lib/server/services/ai/aiProvider";
import { createAIProvider, resetAIProviderForTests } from "../lib/server/services/ai/aiProviderFactory";
import { CvParserService } from "../lib/server/services/cv-parser.service";
import { parseResumeWithAIResult } from "../lib/server/services/resumeAIParser";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetAIProviderForTests();
});

const config = (provider: AIProviderConfig["provider"]): AIProviderConfig => ({
  provider,
  model: provider === "ollama" ? "gemma3:1b" : "test-model",
  baseUrl: provider === "ollama" ? "http://localhost:11434" : "https://provider.test/v1",
  apiKey: provider === "ollama" || provider === "disabled" ? "" : "test-key-not-a-secret",
  timeoutMs: 1_000,
  maxRetries: 0,
  maxOutputTokens: 500
});

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

test("disabled provider is explicit and never calls a network provider", async () => {
  const provider = createAIProvider(config("disabled"));
  await assert.rejects(
    () => provider.chat([{ role: "user", content: "hello" }]),
    (error: unknown) => error instanceof AIProviderError && error.category === "disabled"
  );
  assert.equal((await provider.healthCheck()).status, "disabled");
});

test("Ollama reports available and returns chat output", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/api/tags")) return jsonResponse({ models: [{ name: "gemma3:1b" }] });
    return jsonResponse({ message: { content: "local response" }, prompt_eval_count: 4, eval_count: 2 });
  };
  const provider = createAIProvider(config("ollama"));
  assert.equal((await provider.healthCheck()).status, "available");
  assert.equal((await provider.chat([{ role: "user", content: "hello" }])).content, "local response");
});

test("Ollama unavailable is categorized and resume parsing falls back", async () => {
  globalThis.fetch = async () => { throw new TypeError("connection refused"); };
  const provider = createAIProvider(config("ollama"));
  await assert.rejects(
    () => provider.chat([{ role: "user", content: "hello" }]),
    (error: unknown) => error instanceof AIProviderError && error.category === "unavailable"
  );

  const parser = new CvParserService(false) as unknown as {
    extractCandidateFromResumeText(text: string, fileName: string): Promise<{ email: string; parsedData?: Record<string, unknown> }>;
  };
  const candidate = await parser.extractCandidateFromResumeText(
    "Rakesh Patil\nrakesh@example.com\nSoftware Engineer\n5 years experience\nTypeScript React",
    "rakesh-patil.pdf"
  );
  assert.equal(candidate.email, "rakesh@example.com");
  assert.equal(candidate.parsedData?.parser, "HEURISTIC");
});

for (const providerName of ["openai", "openrouter"] as const) {
  test(`${providerName} health checks the configured model safely`, async () => {
    let requestedUrl = "";
    globalThis.fetch = async (input) => {
      requestedUrl = String(input);
      return jsonResponse({ id: "test-model" });
    };
    const provider = createAIProvider(config(providerName));
    assert.equal((await provider.healthCheck()).status, "available");
    assert.equal(
      requestedUrl,
      providerName === "openai"
        ? "https://provider.test/v1/models/test-model"
        : "https://provider.test/v1/models"
    );
  });

  test(`${providerName} success returns structured data`, async () => {
    globalThis.fetch = async () => jsonResponse({
      choices: [{ message: { content: '{"value":"ok"}' } }],
      usage: { prompt_tokens: 2, completion_tokens: 3 }
    });
    const provider = createAIProvider(config(providerName));
    const result = await provider.generateStructuredData<{ value: string }>({
      messages: [{ role: "user", content: "JSON please" }],
      validate: (payload) => {
        const row = payload as Record<string, unknown>;
        assert.equal(typeof row.value, "string");
        return { value: String(row.value) };
      }
    });
    assert.deepEqual(result, { value: "ok" });
  });

  test(`${providerName} failure is categorized without cross-provider fallback`, async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return jsonResponse({}, 401); };
    const provider = createAIProvider(config(providerName));
    await assert.rejects(
      () => provider.chat([{ role: "user", content: "hello" }]),
      (error: unknown) => error instanceof AIProviderError && error.category === "authentication"
    );
    assert.equal(calls, 1);
  });
}

test("invalid JSON is repaired once and validated", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    const content = calls === 1 ? "not-json" : '{"value":"repaired"}';
    return jsonResponse({ choices: [{ message: { content } }] });
  };
  const provider = createAIProvider(config("openai"));
  const result = await provider.generateStructuredData<{ value: string }>({
    messages: [{ role: "user", content: "JSON please" }],
    validate: (payload) => ({ value: String((payload as Record<string, unknown>).value || "") })
  });
  assert.equal(result.value, "repaired");
  assert.equal(calls, 2);
});

test("OpenAI GPT-5 family requests use reasoning-compatible Chat Completions parameters", async () => {
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    return jsonResponse({ choices: [{ message: { content: "ok" } }] });
  };

  const provider = createAIProvider({
    ...config("openai"),
    model: "gpt-5.4-mini",
    reasoningEffort: "low"
  });
  await provider.chat([{ role: "user", content: "hello" }], {
    temperature: 0.4,
    maxOutputTokens: 320
  });

  assert.equal(requestBody.model, "gpt-5.4-mini");
  assert.equal(requestBody.max_completion_tokens, 320);
  assert.equal(requestBody.reasoning_effort, "low");
  assert.equal("max_tokens" in requestBody, false);
  assert.equal("temperature" in requestBody, false);
});

test("resume extraction includes extended evidence fields and safe metadata", async () => {
  const provider = createAIProvider(config("openai"));
  globalThis.fetch = async () => jsonResponse({ choices: [{ message: { content: JSON.stringify({
    fullName: "Rakesh Patil",
    email: "rakesh@example.com",
    phone: "",
    skills: ["TypeScript"],
    totalExperienceYears: 5,
    relevantExperienceYears: 4,
    location: "Pune",
    currentRole: "Software Engineer",
    currentCompany: "Agodly",
    previousCompanies: ["Example Ltd"],
    education: ["B.E."],
    certifications: ["AWS Certified"],
    linkedin: "",
    github: "",
    portfolio: "https://example.com"
  }) } }] });
  const result = await parseResumeWithAIResult(
    "Rakesh Patil\nrakesh@example.com\nAgodly Software Engineer\nPune\nTypeScript\n5 years experience",
    provider,
    false
  );
  assert.equal(result.data.relevantExperienceYears, 4);
  assert.deepEqual(result.data.certifications, ["AWS Certified"]);
  assert.equal(result.metadata.provider, "openai");
  assert.equal(result.metadata.errorCategory, null);
});
