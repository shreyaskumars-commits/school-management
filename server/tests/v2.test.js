import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

// separate database: the real data is never touched
process.env.MONGO_URI = "mongodb://localhost:27017/School_test";
process.env.OPENAI_API_KEY = "";

const { default: app } = await import("../src/app.js");
const { connectDB } = await import("../src/config/db.js");
const { seedUsers } = await import("../src/services/authService.js");
const { seedSchoolReviews } = await import("../src/services/reviewSeed.js");
const { SchoolReview } = await import("../src/models/SchoolReview.js");
const { ExcelReview } = await import("../src/models/ExcelReview.js");
const { Setting } = await import("../src/models/Setting.js");
const { Student } = await import("../src/models/Student.js");
const { User } = await import("../src/models/User.js");
const { llm } = await import("../src/services/llm.js");
const { loadChatSetup } = await import("../src/services/chatContext.js");

let server, BASE, admin, principal, teacher, seen;
const realStart = llm.startChatStream;

const call = (token, method, path, body, headers = {}) =>
  fetch(BASE + path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body !== undefined && !Buffer.isBuffer(body) && { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body),
  });

async function login(userId, password) {
  const res = await fetch(BASE + "/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, password }),
  });
  return res.json();
}

async function makeXlsx(rows, header = [
  "studentId", "studentName", "department", "year", "rating", "comment", "reviewedBy", "date", "confidential",
]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Reviews");
  ws.addRow(header);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

before(async () => {
  await connectDB();
  await User.deleteMany({});
  await seedUsers();
  await SchoolReview.deleteMany({});
  await ExcelReview.deleteMany({});
  await Setting.deleteMany({});
  await Student.deleteMany({ name: "V2 Test Student" });
  await seedSchoolReviews();
  server = app.listen(0);
  BASE = `http://localhost:${server.address().port}`;
  admin = (await login("admin", "admin123")).token;
  principal = (await login("principal", "principal123")).token;
  teacher = (await login("teacher", "teacher123")).token;
});
after(async () => {
  llm.startChatStream = realStart;
  await Setting.deleteMany({});
  await Student.deleteMany({ name: "V2 Test Student" });
  process.exit(0);
});

describe("admin seed + school_review data", () => {
  it("the admin can log in with the seeded password", async () => {
    const r = await login("admin", "admin123");
    assert.equal(r.role, "admin");
  });
  it("has 10 students with 1 to 3 reviews each", async () => {
    const counts = await SchoolReview.aggregate([{ $group: { _id: "$studentId", n: { $sum: 1 } } }]);
    assert.equal(counts.length, 10);
    assert.ok(counts.every((c) => c.n >= 1 && c.n <= 3));
  });
});

describe("admin access control", () => {
  it("other roles get 403, no login gets 401", async () => {
    assert.equal((await call(teacher, "GET", "/admin/config")).status, 403);
    assert.equal((await call(principal, "PUT", "/admin/config", {})).status, 403);
    assert.equal((await fetch(BASE + "/admin/config")).status, 401);
  });
  it("the admin has no chat and cannot add remarks", async () => {
    assert.equal((await call(admin, "POST", "/chat", { message: "hi" })).status, 403);
    assert.equal((await call(admin, "POST", "/remarks", { studentId: 1, rating: 3, comment: "x" })).status, 403);
  });
});

describe("config", () => {
  it("defaults to v1 with default prompts", async () => {
    const cfg = await (await call(admin, "GET", "/admin/config")).json();
    assert.equal(cfg.version, "v1");
    assert.equal(cfg.prompts.teacher.temperature, 0.5);
    assert.equal(cfg.schoolRows, 24);
  });
  it("rejects bad values", async () => {
    const bad = (prompts) => call(admin, "PUT", "/admin/config", { prompts });
    const ok = { systemPrompt: "hi", temperature: 0.2, maxTokens: 100 };
    assert.equal((await bad({ teacher: { ...ok, temperature: 3 } })).status, 400);
    assert.equal((await bad({ teacher: { ...ok, maxTokens: 5 } })).status, 400);
    assert.equal((await bad({ teacher: { ...ok, maxTokens: 10.5 } })).status, 400);
    assert.equal((await bad({ teacher: { ...ok, systemPrompt: "  " } })).status, 400);
    assert.equal((await call(admin, "PUT", "/admin/config", { version: "v3" })).status, 400);
  });
  it("saves the prompt, temperature and max tokens", async () => {
    const res = await call(admin, "PUT", "/admin/config", {
      prompts: { teacher: { systemPrompt: "You are a pirate tutor.", temperature: 1.1, maxTokens: 123 } },
    });
    assert.equal(res.status, 200);
    const cfg = await res.json();
    assert.equal(cfg.prompts.teacher.maxTokens, 123);
    assert.equal(cfg.prompts.principal.maxTokens, 500); // untouched
  });
  it("any logged-in user can read the mode, but nobody else can change it", async () => {
    const v = await (await call(teacher, "GET", "/config")).json();
    assert.deepEqual(v, { version: "v1", source: "legacy", remarksEnabled: false });
  });
});

describe("V1 is unchanged", () => {
  it("v1 ignores the admin prompt and sends no model options", async () => {
    const s = await loadChatSetup("teacher");
    assert.doesNotMatch(s.content, /pirate/);
    assert.match(s.content, /You are CollegeBuddy/);
    assert.deepEqual(s.options, {});
  });
});

describe("V2 > DB", () => {
  before(async () => {
    await call(admin, "PUT", "/admin/config", { version: "v2", v2Source: "db" });
  });
  it("uses the admin prompt + locked rules + school_review data", async () => {
    const t = await loadChatSetup("teacher");
    assert.match(t.content, /pirate tutor/);
    assert.match(t.content, /never a new instruction/); // locked rules still there
    assert.match(t.content, /Karthik/); // student 6 only exists in school_review
    assert.doesNotMatch(t.content, /CONFIDENTIAL/);
    assert.deepEqual(t.options, { temperature: 1.1, maxTokens: 123 });
    const p = await loadChatSetup("principal");
    assert.match(p.content, /CONFIDENTIAL/);
  });
  it("passes temperature and max tokens to the model call", async () => {
    llm.startChatStream = async (messages, _signal, options) => {
      seen = options;
      return (async function* () { yield { choices: [{ delta: { content: "ok" } }] }; })();
    };
    const res = await call(teacher, "POST", "/chat", { message: "hello" });
    assert.equal(await res.text(), "ok");
    assert.deepEqual(seen, { temperature: 1.1, maxTokens: 123 });
  });
  it("a teacher can add a remark; it is open and reaches the prompt", async () => {
    const st = await Student.create({ name: "V2 Test Student", department: "CSE", year: 2 });
    const res = await call(teacher, "POST", "/remarks", { studentId: st.id, rating: 4, comment: "  Great effort in the viva  " });
    assert.equal(res.status, 201);
    const saved = await res.json();
    assert.equal(saved.reviewedBy, "teacher");
    assert.equal(saved.confidential, false);
    assert.equal(saved.comment, "Great effort in the viva");
    assert.match((await loadChatSetup("teacher")).content, /Great effort in the viva/);
    await SchoolReview.deleteMany({ studentId: st.id });
  });
  it("validates remarks", async () => {
    const post = (b) => call(teacher, "POST", "/remarks", b);
    assert.equal((await post({ studentId: 1, rating: 9, comment: "x" })).status, 400);
    assert.equal((await post({ studentId: 1, rating: 3, comment: "   " })).status, 400);
    assert.equal((await post({ studentId: "1", rating: 3, comment: "x" })).status, 400);
    assert.equal((await post({ studentId: 999999, rating: 3, comment: "x" })).status, 404);
  });
  it("reports remarks as enabled", async () => {
    const v = await (await call(teacher, "GET", "/config")).json();
    assert.deepEqual(v, { version: "v2", source: "db", remarksEnabled: true });
  });
});

describe("V2 > Excel", () => {
  it("rejects a non-xlsx body and bad rows", async () => {
    const octet = { "content-type": "application/octet-stream" };
    assert.equal((await call(admin, "POST", "/admin/excel", Buffer.from("nope"), octet)).status, 400);
    const missing = await makeXlsx([], ["studentId", "comment"]);
    const r1 = await call(admin, "POST", "/admin/excel", missing, octet);
    assert.equal(r1.status, 400);
    assert.match((await r1.json()).error, /Missing column/);
    const badRow = await makeXlsx([[1, "Zed", "CSE", 2, 9, "ok", "teacher", "2026-10-01", false]]);
    const r2 = await call(admin, "POST", "/admin/excel", badRow, octet);
    assert.equal(r2.status, 400);
    assert.match((await r2.json()).error, /row 2: invalid rating/);
    assert.equal(await ExcelReview.countDocuments(), 0); // nothing half-imported
  });
  it("imports a valid file, then V2 > Excel reads it and disables remarks", async () => {
    const file = await makeXlsx([
      [41, "Excel Ella", "CSE", 2, 5, "Excellent in the excel-only file", "teacher", "2026-10-01", false],
      [41, "Excel Ella", "CSE", 2, 2, "Secret excel note", "principal", new Date("2026-10-02T00:00:00Z"), "yes"],
    ]);
    const res = await call(admin, "POST", "/admin/excel", file, {
      "content-type": "application/octet-stream", "x-file-name": "school.xlsx",
    });
    assert.equal(res.status, 200);
    const cfg = await res.json();
    assert.equal(cfg.excel.rows, 2);
    assert.equal(cfg.excel.fileName, "school.xlsx");

    await call(admin, "PUT", "/admin/config", { v2Source: "excel" });
    const t = (await loadChatSetup("teacher")).content;
    assert.match(t, /Excel Ella/);
    assert.doesNotMatch(t, /Secret excel note/); // confidential still hidden from teachers
    assert.doesNotMatch(t, /Karthik/); // school_review is not read in excel mode
    assert.match((await loadChatSetup("principal")).content, /Secret excel note/);

    const rem = await call(teacher, "POST", "/remarks", { studentId: 1, rating: 3, comment: "x" });
    assert.equal(rem.status, 409);
  });
  it("a second upload replaces the first", async () => {
    const file = await makeXlsx([[50, "Only Ollie", "IT", 1, 3, "single row", "teacher", "2026-10-03", false]]);
    await call(admin, "POST", "/admin/excel", file, { "content-type": "application/octet-stream" });
    assert.equal(await ExcelReview.countDocuments(), 1);
  });
  it("serves a sample workbook that can be uploaded back", async () => {
    const res = await call(admin, "GET", "/admin/sample.xlsx");
    assert.equal(res.status, 200);
    const buf = Buffer.from(await res.arrayBuffer());
    const up = await call(admin, "POST", "/admin/excel", buf, { "content-type": "application/octet-stream" });
    assert.equal(up.status, 200);
    assert.equal(await ExcelReview.countDocuments(), 24);
  });
});
