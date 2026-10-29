import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createStudent,
  deleteStudent,
  getStudents,
  updateStudent,
} from "../src/api.js";

function mockFetch(status, body) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("getStudents builds the query string", async () => {
    const fn = mockFetch(200, { total: 0, data: [] });
    await getStudents({ page: 2, limit: 5, department: "CSE" });
    expect(fn.mock.calls[0][0]).toBe(
      "http://localhost:3000/students?page=2&limit=5&department=CSE",
    );
  });

  it("getStudents leaves out an empty department", async () => {
    const fn = mockFetch(200, { total: 0, data: [] });
    await getStudents({ page: 1, limit: 5, department: "" });
    expect(fn.mock.calls[0][0]).not.toContain("department");
  });

  it("createStudent POSTs JSON", async () => {
    const fn = mockFetch(201, { id: 105 });
    const result = await createStudent({ name: "Zed" });
    const [, options] = fn.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.body).toBe('{"name":"Zed"}');
    expect(result).toEqual({ id: 105 });
  });

  it("updateStudent PATCHes the right url", async () => {
    const fn = mockFetch(200, {});
    await updateStudent(7, { year: 3 });
    expect(fn.mock.calls[0][0]).toBe("http://localhost:3000/students/7");
    expect(fn.mock.calls[0][1].method).toBe("PATCH");
  });

  it("deleteStudent handles 204 with no body", async () => {
    const fn = mockFetch(204, undefined);
    expect(await deleteStudent(7)).toBeNull();
    expect(fn.mock.calls[0][1].method).toBe("DELETE");
  });

  it("throws the server's error message", async () => {
    mockFetch(404, { error: "Student 9 not found" });
    await expect(deleteStudent(9)).rejects.toThrow("Student 9 not found");
  });

  it("falls back to a generic message", async () => {
    mockFetch(500, {});
    await expect(getStudents({ page: 1, limit: 5 })).rejects.toThrow(
      "Request failed",
    );
  });
});
