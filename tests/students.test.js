import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

// server.js starts listening on port 3000 as soon as it is imported
const BASE = "http://localhost:3000";
let server;

before(async () => {
  server = await import("../server.js");
});
after(() => process.exit(0)); // the app has no close(), so end the process

async function call(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

describe("GET /students", () => {
  it("lists the seeded students", async () => {
    const { status, body } = await call("GET", "/students");
    assert.equal(status, 200);
    assert.equal(body.total, 4);
    assert.equal(body.data.length, 4);
  });

  it("filters by department, ignoring case", async () => {
    const { body } = await call("GET", "/students?department=cse");
    assert.equal(body.total, 2);
    assert.ok(body.data.every((s) => s.department === "CSE"));
  });

  it("paginates", async () => {
    const { body } = await call("GET", "/students?page=2&limit=3");
    assert.equal(body.data.length, 1);
    assert.equal(body.total, 4);
  });

  it("rejects bad page or limit", async () => {
    assert.equal((await call("GET", "/students?page=0")).status, 400);
    assert.equal((await call("GET", "/students?limit=abc")).status, 400);
  });
});

describe("GET /students/:id", () => {
  it("returns one student", async () => {
    const { status, body } = await call("GET", "/students/101");
    assert.equal(status, 200);
    assert.equal(body.name, "Asha");
  });
  it("404 for unknown id", async () => {
    assert.equal((await call("GET", "/students/999")).status, 404);
  });
  it("400 for a non-numeric id", async () => {
    assert.equal((await call("GET", "/students/abc")).status, 400);
  });
});

describe("create, update, delete", () => {
  let id;

  it("POST creates, trims and defaults year to 1", async () => {
    const { status, body } = await call("POST", "/students", {
      name: "  Zed ",
      department: " MECH ",
    });
    assert.equal(status, 201);
    assert.equal(body.name, "Zed");
    assert.equal(body.department, "MECH");
    assert.equal(body.year, 1);
    id = body.id;
  });

  it("POST rejects missing fields (400) and bad values (422)", async () => {
    assert.equal((await call("POST", "/students", { name: "x" })).status, 400);
    assert.equal((await call("POST", "/students")).status, 400);
    assert.equal((await call("POST", "/students", { name: "x", department: "y", year: 9 })).status, 422);
    assert.equal((await call("POST", "/students", { name: "x", department: "y", year: "2" })).status, 422);
    assert.equal((await call("POST", "/students", { name: "  ", department: "y" })).status, 422);
  });

  it("POST rejects malformed JSON", async () => {
    assert.equal((await call("POST", "/students", "{bad")).status, 400);
  });

  it("PATCH changes only the fields sent", async () => {
    const { status, body } = await call("PATCH", `/students/${id}`, { year: 3 });
    assert.equal(status, 200);
    assert.equal(body.student.year, 3);
    assert.equal(body.student.name, "Zed");
    assert.equal(body.notified, false);
    assert.equal((await call("GET", `/students/${id}`)).body.year, 3);
  });

  it("PATCH ?notify=true sets the demo flag", async () => {
    const { body } = await call("PATCH", `/students/${id}?notify=true`, { name: "Zed2" });
    assert.equal(body.notified, true);
  });

  it("PATCH validates input and the id", async () => {
    assert.equal((await call("PATCH", `/students/${id}`, {})).status, 400);
    assert.equal((await call("PATCH", `/students/${id}`, { year: 0 })).status, 422);
    assert.equal((await call("PATCH", "/students/999", { year: 2 })).status, 404);
  });

  it("DELETE removes the student", async () => {
    assert.equal((await call("DELETE", `/students/${id}`)).status, 204);
    assert.equal((await call("GET", `/students/${id}`)).status, 404);
    assert.equal((await call("DELETE", `/students/${id}`)).status, 404);
  });

  it("does not reuse the deleted id", async () => {
    const { body } = await call("POST", "/students", { name: "Next", department: "IT" });
    assert.ok(body.id > id);
  });
});

describe("misc", () => {
  it("PUT is not defined", async () => {
    assert.equal((await call("PUT", "/students/101", { name: "a" })).status, 404);
  });
  it("classroom notes need the key", async () => {
    assert.equal((await call("GET", "/classroom/notes")).status, 401);
    const ok = await call("GET", "/classroom/notes", undefined, { "x-classroom-key": "learn-node" });
    assert.equal(ok.status, 200);
  });
  it("crash route returns a clean 500", async () => {
    const { status, body } = await call("GET", "/classroom/crash");
    assert.equal(status, 500);
    assert.equal(body.error, "Something went wrong");
  });
  it("allows the frontend origin via CORS", async () => {
    const res = await fetch(`${BASE}/students`, { headers: { Origin: "http://localhost:5173" } });
    assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
  });
  it("does not allow other origins", async () => {
    const res = await fetch(`${BASE}/students`, { headers: { Origin: "http://evil.test" } });
    assert.notEqual(res.headers.get("access-control-allow-origin"), "http://evil.test");
  });
});
