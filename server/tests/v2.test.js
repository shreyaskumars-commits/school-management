import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

// separate database: the real data is never touched
process.env.MONGO_URI = "mongodb://localhost:27017/School_test";
process.env.OPENAI_API_KEY = "";

const { default: app } = await import("../src/app.js");
const { connectDB } = await import("../src/config/db.js");
const { seedUsers } = await import("../src/services/authService.js");
const { seedSchoolReviews } = await import("../src/services/reviewSeed.js");
const { SchoolReview } = await import("../src/models/SchoolReview.js");
const { Setting } = await import("../src/models/Setting.js");
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

before(async () => {
  await connectDB();
  await User.deleteMany({});
  await seedUsers();
  await SchoolReview.deleteMany({});
  await Setting.deleteMany({});
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
  it("the admin has no chat", async () => {
    assert.equal((await call(admin, "POST", "/chat", { message: "hi" })).status, 403);
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
});

