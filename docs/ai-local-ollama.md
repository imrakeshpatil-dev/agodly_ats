# Local AI with Ollama

Agodly ATS uses Ollama by default. AI is an enhancement: if Ollama is stopped or its model is unavailable, resume uploads continue through the deterministic parser and AI Match continues with its evidence-based scoring.

## Setup

1. Install and start Ollama from the official Ollama distribution.
2. Run `ollama pull gemma3:1b` (or choose another supported local model).
3. Configure the server environment:

   ```dotenv
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=gemma3:1b
   AI_REQUEST_TIMEOUT_MS=30000
   AI_MAX_RETRIES=1
   AI_MAX_OUTPUT_TOKENS=2000
   AI_RESUME_MAX_CHARS=18000
   ```

4. Start the ATS with `npm run dev`.

Founder Diagnostics shows provider/model, availability, fallback readiness, and the last successful AI request. It never exposes keys or prompts.

## Fallback behavior

The ATS calls only the configured provider. If Ollama times out, is unavailable, or returns invalid JSON after one repair attempt, resume parsing uses the existing heuristic parser. It never switches to OpenAI or OpenRouter automatically.

Successful resume AI results are cached by a SHA-256 hash of resume text plus provider and model. Raw resume text is not used as a cache key.
