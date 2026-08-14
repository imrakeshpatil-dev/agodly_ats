# Production AI provider configuration

AI providers are selected explicitly with `AI_PROVIDER`. Supported values are `ollama`, `openai`, `openrouter`, and `disabled`. Changing this value does not alter or delete ATS database records.

## OpenAI

Store the key only in the production host's encrypted server environment:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=replace-in-host-secret-manager
OPENAI_MODEL=gpt-4.1-mini
AI_REQUEST_TIMEOUT_MS=30000
AI_MAX_RETRIES=1
AI_MAX_OUTPUT_TOKENS=2000
```

## OpenRouter

```dotenv
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=replace-in-host-secret-manager
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_REQUEST_TIMEOUT_MS=30000
AI_MAX_RETRIES=1
AI_MAX_OUTPUT_TOKENS=2000
```

Set `AI_PROVIDER=disabled` to keep core ATS operations, deterministic resume extraction, candidate search, and deterministic AI Match scoring available without an AI provider.

## Security and cost controls

- Never expose provider keys through browser code or `NEXT_PUBLIC_*` variables.
- Keep `.env.local` and production secret files out of Git.
- Use a restricted project key, rotate it periodically, and configure provider-side spend limits and alerts.
- Prompt length, output tokens, timeout, and retries are bounded; retries are capped at one.
- Logs and parsing metadata contain provider/model/status/category information—not keys, full prompts, or full model responses.
- A failed provider falls back only to deterministic behavior; it never invokes another paid provider.

Check Founder Diagnostics before enabling a production provider. Never put a key in source files, `render.yaml`, the database, or client settings.
