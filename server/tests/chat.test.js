import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";

process.env.MONGO_URI = "mongodb://localhost:27017/School_test";
process.env.OPENAI_API_KEY = "";

const { default: app } = await import("../src/app.js");
const { connectDB } = await import("../src/config/db.js");
const { seedUsers } = await import("../src/services/authService.js");
const { seedReviews } = await import("../src/services/reviewSeed.js");
const { Review } = await import("../src/models/Review.js");
const { Conversation } = await import("../src/models/Conversation.js");
const { User } = await import("../src/models/User.js");
const { llm, trimHistory, estimateTokens } = await import("../src/services/llm.js");
const { reviewFilterFor, loadSystemPrompt } = await import("../src/services/chatContext.js");

const realStartChatStream = llm.startChatStream;
let server;
let BASE;
let principalToken;
let teacherToken;
let seenMessages;

function fakeModel(pieces, { failAfter = false } = {}) {
  llm.startChatStream = async (messages) => {
    seenMessages = messages;
    return (async function* () {
      for (const p of pieces) yield { choices: [{ delta: { content: p } }] };
      yield { choices: [{ delta: {} }] };
      if (failAfter) throw new Error("boom");
    })();
  };
}

async function login(userId, password) {
  const res = await fetch(BASE + "/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, password }),
  });
  return res.json();
}

const send = (token, message) =>
  fetch(BASE + "/chat", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });

const history = async (token) =>
  (await fetch(BASE + "/chat/history", { headers: { authorization: `Bearer ${token}` } })).json();

before(async () => {
  await connectDB();
  await seedUsers();
  await Review.deleteMany({});
  await Conversation.deleteMany({});
  await seedReviews();
  server = app.listen(0);
  BASE = `http://localhost:${server.address().port}`;
  principalToken = (await login("principal", "principal123")).token;
  teacherToken = (await login("teacher", "teacher123")).token;
});
after(() => process.exit(0));

describe("seed data", () => {
  it("has 5 students with 3 reviews each", async () => {
    const counts = await Review.aggregate([{ $group: { _id: "$studentId", n: { $sum: 1 } } }]);
    assert.equal(counts.length, 5);
    assert.ok(counts.every((c) => c.n === 3));
  });
});

describe("trimHistory", () => {
  it("keeps the newest messages that fit the budget", () => {
    const msgs = [
      { role: "user", content: "Hi! I am Priya." },
      { role: "assistant", content: "Hello Priya! How can I help?" },
      { role: "user", content: "x".repeat(400) },
      { role: "assistant", content: "Done. Anything else?" },
      { role: "user", content: "What is my name?" },
    ];
    assert.equal(estimateTokens("x".repeat(400)), 100);
    const kept = trimHistory(msgs, { maxTokens: 20 });
    assert.deepEqual(kept.map((m) => m.content), ["Done. Anything else?", "What is my name?"]);
  });
  it("caps the number of messages", () => {
    const msgs = Array.from({ length: 30 }, (_, i) => ({ role: "user", content: `m${i}` }));
    assert.equal(trimHistory(msgs).length, 20);
  });
});

describe("role-based context", () => {
  it("the principal sees confidential reviews, a teacher does not", async () => {
    const principal = await loadSystemPrompt("principal");
    const teacher = await loadSystemPrompt("teacher");
    assert.match(principal, /CONFIDENTIAL/);
    assert.match(principal, /discipline committee/);
    assert.doesNotMatch(teacher, /CONFIDENTIAL/);
    assert.doesNotMatch(teacher, /discipline committee/);
    assert.match(teacher, /Data Structures/);
  });
  it("an unknown role gets no data", async () => {
    assert.equal(reviewFilterFor("student"), null);
    assert.match(await loadSystemPrompt("student"), /no reviews available/);
  });
});

describe("POST /chat and GET /chat/history", () => {
  it("needs a login", async () => {
    assert.equal((await send("nope", "hi")).status, 401);
    assert.equal((await fetch(BASE + "/chat/history")).status, 401);
  });

  it("rejects empty and too-long messages", async () => {
    assert.equal((await send(principalToken, "   ")).status, 400);
    assert.equal((await send(principalToken, "a".repeat(2001))).status, 400);
  });

  it("streams the reply and saves both messages", async () => {
    fakeModel(["Asha ", "is ", "doing well."]);
    const res = await send(principalToken, "How is Asha?");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/plain/);
    assert.equal(await res.text(), "Asha is doing well.");

    const { messages } = await history(principalToken);
    assert.deepEqual(messages.map((m) => [m.role, m.content]), [
      ["user", "How is Asha?"],
      ["assistant", "Asha is doing well."],
    ]);
    assert.equal(seenMessages[0].role, "system");
    assert.equal(seenMessages.at(-1).content, "How is Asha?");
  });

  it("each user has a separate history", async () => {
    assert.deepEqual((await history(teacherToken)).messages, []);
  });

  it("sends earlier messages back to the model", async () => {
    fakeModel(["ok"]);
    await send(principalToken, "And Ravi?");
    const roles = seenMessages.map((m) => m.role);
    assert.deepEqual(roles, ["system", "user", "assistant", "user"]);
  });

  it("a teacher's prompt has no confidential data; the principal's does", async () => {
    fakeModel(["ok"]);
    await send(teacherToken, "Any warnings for Ravi?");
    assert.doesNotMatch(seenMessages[0].content, /discipline committee/);
    await send(principalToken, "Any warnings for Ravi?");
    assert.match(seenMessages[0].content, /discipline committee/);
  });

  it("ignores a role sent in the request body", async () => {
    fakeModel(["ok"]);
    await fetch(BASE + "/chat", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ message: "hi", role: "principal" }),
    });
    assert.doesNotMatch(seenMessages[0].content, /discipline committee/);
  });

  it("answers with a friendly JSON error when the model fails before streaming", async () => {
    llm.startChatStream = async () => {
      throw new OpenAI.RateLimitError(429, {}, "quota", new Headers());
    };
    const res = await send(principalToken, "hello");
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), { error: "The AI is busy right now. Try in a minute." });
  });

  it("explains a missing API key without leaking details", async () => {
    llm.startChatStream = realStartChatStream;
    const res = await send(principalToken, "hello");
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: "AI is not configured correctly." });
  });

  it("adds a note and keeps the partial reply when the stream breaks", async () => {
    fakeModel(["Half an ans"], { failAfter: true });
    const res = await send(principalToken, "break");
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Half an ans\n\n\[Sorry, the reply was cut off/);
    const { messages } = await history(principalToken);
    assert.equal(messages.at(-1).content, "Half an ans");
  });

  it("stops at the daily limit", async () => {
    const user = await User.findOne({ Username: "principal" });
    const today = new Date().toISOString().slice(0, 10);
    await Conversation.updateOne(
      { user: user._id },
      { $set: { "usage.date": today, "usage.count": 50 } }
    );
    fakeModel(["never"]);
    const res = await send(principalToken, "one more");
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), { error: "Daily chat limit reached." });
  });

  it("limits messages per minute, per user", async () => {
    fakeModel(["ok"]);
    const statuses = [];
    for (let i = 0; i < 12; i++) statuses.push((await send(teacherToken, `m${i}`)).status);
    assert.equal(statuses[0], 200);
    assert.ok(statuses.includes(429));
    const res = await fetch(BASE + "/chat/history", { headers: { authorization: `Bearer ${principalToken}` } });
    assert.equal(res.status, 200);
  });

  it("DELETE /chat/history clears the conversation", async () => {
    const res = await fetch(BASE + "/chat/history", {
      method: "DELETE",
      headers: { authorization: `Bearer ${principalToken}` },
    });
    assert.equal(res.status, 204);
    assert.deepEqual((await history(principalToken)).messages, []);
  });
});
