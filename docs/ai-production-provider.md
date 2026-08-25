# Production AI provider configuration

AI providers are selected explicitly with `AI_PROVIDER`. Supported values are `ollama`, `openai`, `openrouter`, and `disabled`. Changing this value does not alter or delete ATS database records.

## OpenAI

Store the key only in the production host's encrypted server environment:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=replace-in-host-secret-manager
# Legacy single-model setting retained for rollback compatibility.
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BULK_MODEL=gpt-5.6-luna
OPENAI_STANDARD_MODEL=gpt-5.4-mini
OPENAI_COMPLEX_MODEL=gpt-5.6-terra
AI_REQUEST_TIMEOUT_MS=30000
AI_MAX_RETRIES=1
AI_MAX_OUTPUT_TOKENS=2000
```

The server routes bulk CV extraction and basic classification to Luna, routine matching and recruiter assistance to Mini, and candidate comparisons, hiring-demand analysis, forecasts, and other difficult prompts to Terra. OpenAI GPT-5 requests use `max_completion_tokens` and an explicit reasoning effort (`low` for bulk/standard, `medium` for complex).

Before changing production, verify that the production OpenAI project can list and call all three model IDs. A missing model must block deployment rather than silently changing the workload assignment.

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
