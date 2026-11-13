import ExcelJS from "exceljs";
import { ExcelReview } from "../models/ExcelReview.js";
import { loadSchoolSeed } from "./reviewSeed.js";

export const COLUMNS = [
  "studentId", "studentName", "department", "year",
  "rating", "comment", "reviewedBy", "date", "confidential",
];

// header names the admin may use -> our field names
const ALIASES = { name: "studentName", student: "studentName", id: "studentId" };

function cellValue(cell) {
  const v = cell.value;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) return v.result; // formula
    if ("text" in v) return v.text; // hyperlink
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
  }
  return v;
}

const toDateString = (v) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const toBool = (v) => {
  if (typeof v === "boolean") return v;
  return ["true", "yes", "y", "1"].includes(String(v ?? "").trim().toLowerCase());
};

// parses an .xlsx buffer into review documents.
// Throws an Error (with .status 400) listing up to 5 problems.
export async function parseWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw Object.assign(new Error("That is not a valid .xlsx file"), { status: 400 });
  }
  const sheet = wb.worksheets[0];
  if (!sheet) throw Object.assign(new Error("The workbook has no sheet"), { status: 400 });

  const columnOf = {};
  sheet.getRow(1).eachCell((cell, col) => {
    const raw = String(cellValue(cell) ?? "").trim();
    const key = COLUMNS.find((c) => c.toLowerCase() === raw.toLowerCase())
      ?? ALIASES[raw.toLowerCase()];
    if (key) columnOf[key] = col;
  });
  const required = COLUMNS.filter((c) => c !== "confidential");
  const missing = required.filter((c) => !columnOf[c]);
  if (missing.length) {
    throw Object.assign(
      new Error(`Missing column(s) in row 1: ${missing.join(", ")}`),
      { status: 400 }
    );
  }

  const rows = [];
  const problems = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const get = (k) => (columnOf[k] ? cellValue(row.getCell(columnOf[k])) : undefined);
    if (required.every((k) => get(k) == null || get(k) === "")) return; // blank row

    const doc = {
      studentId: Number(get("studentId")),
      studentName: String(get("studentName") ?? "").trim(),
      department: String(get("department") ?? "").trim(),
      year: Number(get("year")),
      rating: Number(get("rating")),
      comment: String(get("comment") ?? "").trim(),
      reviewedBy: String(get("reviewedBy") ?? "").trim(),
      date: toDateString(get("date")),
      confidential: toBool(get("confidential")),
    };
    const bad =
      !Number.isInteger(doc.studentId) || doc.studentId < 1 ? "studentId" :
      !doc.studentName ? "studentName" :
      !doc.department ? "department" :
      !Number.isInteger(doc.year) || doc.year < 1 || doc.year > 4 ? "year (1-4)" :
      !Number.isInteger(doc.rating) || doc.rating < 1 || doc.rating > 5 ? "rating (1-5)" :
      !doc.comment ? "comment" :
      !doc.reviewedBy ? "reviewedBy" :
      !doc.date ? "date (YYYY-MM-DD)" : null;
    if (bad) problems.push(`row ${n}: invalid ${bad}`);
    else rows.push(doc);
  });

  if (problems.length) {
    const more = problems.length > 5 ? ` (+${problems.length - 5} more)` : "";
    throw Object.assign(new Error(problems.slice(0, 5).join("; ") + more), { status: 400 });
  }
  if (!rows.length) throw Object.assign(new Error("The sheet has no review rows"), { status: 400 });
  if (rows.length > 5000) throw Object.assign(new Error("Too many rows (max 5000)"), { status: 400 });
  return rows;
}

// replaces everything in excel_review with the parsed rows
export async function replaceExcelReviews(rows) {
  await ExcelReview.deleteMany({});
  await ExcelReview.insertMany(rows);
}

// builds a sample .xlsx from the 10-student mock data
export async function buildSampleWorkbook() {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Reviews");
  sheet.addRow(COLUMNS);
  sheet.getRow(1).font = { bold: true };
  for (const r of loadSchoolSeed()) sheet.addRow(COLUMNS.map((c) => r[c]));
  COLUMNS.forEach((c, i) => { sheet.getColumn(i + 1).width = c === "comment" ? 70 : 16; });
  return wb.xlsx.writeBuffer();
}
