import { promises as fs } from "fs";

import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export const extractTextFromPDF = async (filePath: string): Promise<string> => {
  const buffer = await fs.readFile(filePath);
  const parsed = await pdfParse(buffer);
  return cleanResumeText(parsed.text || "");
};

export const extractTextFromDOCX = async (filePath: string): Promise<string> => {
  const parsed = await mammoth.extractRawText({ path: filePath });
  return cleanResumeText(parsed.value || "");
};

const cleanResumeText = (rawText: string): string =>
  String(rawText || "")
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

