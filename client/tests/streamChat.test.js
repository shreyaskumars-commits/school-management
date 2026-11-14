import { afterEach, expect, it, vi } from "vitest";
import { streamChat } from "../src/api.js";

afterEach(() => vi.unstubAllGlobals());

function streamOf(parts) {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      parts.forEach((p) => controller.enqueue(typeof p === "string" ? enc.encode(p) : p));
      controller.close();
    },
  });
}

it("passes every decoded piece to onChunk", async () => {
  const fn = vi.fn().mockResolvedValue({ ok: true, status: 200, body: streamOf(["Hel", "lo"]) });
  vi.stubGlobal("fetch", fn);
  const pieces = [];
  await streamChat("hi", (p) => pieces.push(p));
  expect(pieces.join("")).toBe("Hello");
  expect(fn.mock.calls[0][0]).toBe("http://localhost:3000/chat");
  expect(JSON.parse(fn.mock.calls[0][1].body)).toEqual({ message: "hi" });
});

it("does not break a character split across two chunks", async () => {
  const bytes = new TextEncoder().encode("é");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamOf([bytes.slice(0, 1), bytes.slice(1)]),
    }),
  );
  let text = "";
  await streamChat("hi", (p) => (text += p));
  expect(text).toBe("é");
});

it("throws the server's JSON error message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "Daily chat limit reached." }),
    }),
  );
  await expect(streamChat("hi", () => {})).rejects.toThrow("Daily chat limit reached.");
});
