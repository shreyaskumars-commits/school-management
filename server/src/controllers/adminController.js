import { ExcelReview } from "../models/ExcelReview.js";
import { SchoolReview } from "../models/SchoolReview.js";
import {
  getSettings, updateSettings, validateConfig, publicView,
} from "../services/settingsService.js";
import {
  parseWorkbook, replaceExcelReviews, buildSampleWorkbook,
} from "../services/excelService.js";
import { Setting } from "../models/Setting.js";

async function fullView() {
  const s = (await getSettings()).toObject();
  return {
    ...publicView(s),
    version: s.version,
    v2Source: s.v2Source,
    prompts: s.prompts,
    excel: {
      fileName: s.excelFileName,
      uploadedAt: s.excelUploadedAt,
      rows: await ExcelReview.countDocuments(),
    },
    schoolRows: await SchoolReview.countDocuments(),
  };
}

export async function getConfig(req, res) {
  res.json(await fullView());
}

export async function putConfig(req, res) {
  const { error, patch } = validateConfig(req.body ?? {});
  if (error) return res.status(400).json({ error });
  await updateSettings(patch);
  res.json(await fullView());
}

// body is the raw .xlsx bytes (express.raw); the file name comes in a header
export async function uploadExcel(req, res) {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: "Send the .xlsx file as the request body" });
  }
  const rows = await parseWorkbook(req.body); // throws 400 with a readable message
  await replaceExcelReviews(rows);
  const fileName = String(req.get("x-file-name") ?? "upload.xlsx").slice(0, 120);
  await Setting.updateOne(
    { key: "main" },
    { $set: { excelFileName: fileName, excelUploadedAt: new Date() } }
  );
  res.json(await fullView());
}

export async function sampleExcel(req, res) {
  const buffer = await buildSampleWorkbook();
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="sample-reviews.xlsx"');
  res.send(Buffer.from(buffer));
}
