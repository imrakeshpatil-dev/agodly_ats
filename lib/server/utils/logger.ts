type LogMeta = Record<string, unknown>;

const formatMeta = (meta?: LogMeta): string => {
  if (!meta) return "";
  return ` ${JSON.stringify(meta)}`;
};

export const logger = {
  info: (message: string, meta?: LogMeta): void => {
    // eslint-disable-next-line no-console
    console.log(`[INFO] ${message}${formatMeta(meta)}`);
  },
  warn: (message: string, meta?: LogMeta): void => {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] ${message}${formatMeta(meta)}`);
  },
  error: (message: string, meta?: LogMeta): void => {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${message}${formatMeta(meta)}`);
  }
};
