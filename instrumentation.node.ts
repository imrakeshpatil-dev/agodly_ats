// Node-only startup logic, kept in a separate module so it is never pulled into
// the Edge instrumentation bundle (which has no `fs`). Imported dynamically from
// instrumentation.ts only when NEXT_RUNTIME === "nodejs".
import { getFatalConfigErrors } from "./lib/server/config/env";
import { authService } from "./lib/server/services/auth.service";
import { logger } from "./lib/server/utils/logger";

export async function init(): Promise<void> {
  const fatalErrors = getFatalConfigErrors();
  if (fatalErrors.length > 0) {
    for (const error of fatalErrors) {
      logger.error(`Fatal configuration error: ${error}`);
    }
    logger.error("Refusing to start with an insecure production configuration.");
    process.exit(1);
  }

  await authService.loadRevokedTokens();
  logger.info("Agodly ATS instrumentation initialized", {
    environment: process.env.NODE_ENV ?? "development"
  });
}
