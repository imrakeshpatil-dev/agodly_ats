import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";

import { CvParserService } from "../lib/server/services/cv-parser.service";

test("XLSX candidate imports map familiar Excel headings without saving data", async () => {
  const zip = new JSZip();
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
      <row r="1">
        <c r="A1" t="inlineStr"><is><t>Candidate Name</t></is></c><c r="B1" t="inlineStr"><is><t>Email ID</t></is></c>
        <c r="C1" t="inlineStr"><is><t>Mobile</t></is></c><c r="D1" t="inlineStr"><is><t>Designation</t></is></c>
        <c r="E1" t="inlineStr"><is><t>Experience Years</t></is></c><c r="F1" t="inlineStr"><is><t>City</t></is></c>
        <c r="G1" t="inlineStr"><is><t>Skills</t></is></c>
      </row>
      <row r="2">
        <c r="A2" t="inlineStr"><is><t>Asha Rao</t></is></c><c r="B2" t="inlineStr"><is><t>asha@example.com</t></is></c>
        <c r="C2" t="inlineStr"><is><t>+91 99999 11111</t></is></c><c r="D2" t="inlineStr"><is><t>Data Engineer</t></is></c>
        <c r="E2"><v>6</v></c><c r="F2" t="inlineStr"><is><t>Pune</t></is></c><c r="G2" t="inlineStr"><is><t>Python, AWS</t></is></c>
      </row>
    </sheetData></worksheet>`);
  const bytes = await zip.generateAsync({ type: "nodebuffer" });

  const service = new CvParserService(false);
  const candidates = await service.parseSpreadsheet(Buffer.from(bytes), "team.xlsx");

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, "Asha Rao");
  assert.equal(candidates[0].currentRole, "Data Engineer");
  assert.equal(candidates[0].experienceYears, 6);
  assert.deepEqual(candidates[0].skills, ["python", "aws"]);
  assert.equal(candidates[0].source, "Excel Upload (team.xlsx)");
});
