import os from "os";
import path from "path";

export const resolveRuntimeDataPath = (fileName: string): string => {
  const configuredDir = String(process.env.AGODLY_DATA_DIR || "").trim();
  const baseDir = configuredDir || path.resolve(process.cwd(), "data");
  return path.resolve(baseDir, fileName);
};

export const resolveRuntimeTempPath = (fileName: string): string => {
  const configuredDir = String(process.env.AGODLY_TMP_DIR || "").trim();
  const baseDir = configuredDir || path.join(os.tmpdir(), "agodly-ats");
  return path.resolve(baseDir, fileName);
};
