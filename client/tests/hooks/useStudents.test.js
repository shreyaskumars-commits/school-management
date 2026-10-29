import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/api.js";
import useStudents from "../../src/hooks/useStudents.js";

vi.mock("../../src/api.js");

const ASHA = { id: 101, name: "Asha", department: "CSE", year: 2 };

beforeEach(() => {
  vi.resetAllMocks();
  api.getStudents.mockResolvedValue({ total: 1, data: [ASHA] });
});

describe("useStudents", () => {
  it("loads the first page on mount", async () => {
    const { result } = renderHook(() => useStudents());
    await waitFor(() => expect(result.current.students).toEqual([ASHA]));
    expect(result.current.total).toBe(1);
    expect(api.getStudents).toHaveBeenCalledWith({
      page: 1,
      limit: 5,
      department: "",
    });
  });

  it("computes totalPages from the total", async () => {
    api.getStudents.mockResolvedValue({ total: 11, data: [ASHA] });
    const { result } = renderHook(() => useStudents());
    await waitFor(() => expect(result.current.totalPages).toBe(3));
  });

  it("add() calls the api, sets a message and reloads", async () => {
    api.createStudent.mockResolvedValue({});
    const { result } = renderHook(() => useStudents());
    await waitFor(() => expect(api.getStudents).toHaveBeenCalledTimes(1));

    let ok;
    await act(async () => {
      ok = await result.current.add({ name: "Zed" });
    });
    expect(ok).toBe(true);
    expect(api.createStudent).toHaveBeenCalledWith({ name: "Zed" });
    expect(result.current.message).toEqual({
      text: "Student added",
      isError: false,
    });
    await waitFor(() => expect(api.getStudents).toHaveBeenCalledTimes(2));
  });

  it("returns false and shows the error when a call fails", async () => {
    api.updateStudent.mockRejectedValue(new Error("year must be 1 to 4"));
    const { result } = renderHook(() => useStudents());
    await waitFor(() => expect(result.current.students).toHaveLength(1));

    let ok;
    await act(async () => {
      ok = await result.current.update(101, { year: 9 });
    });
    expect(ok).toBe(false);
    expect(result.current.message).toEqual({
      text: "year must be 1 to 4",
      isError: true,
    });
  });

  it("remove() reports which student was deleted", async () => {
    api.deleteStudent.mockResolvedValue(null);
    const { result } = renderHook(() => useStudents());
    await waitFor(() => expect(result.current.students).toHaveLength(1));
    await act(async () => {
      await result.current.remove(ASHA);
    });
    expect(api.deleteStudent).toHaveBeenCalledWith(101);
    expect(result.current.message.text).toBe("Deleted Asha");
  });

  it("goes back a page when the current page no longer exists", async () => {
    api.getStudents
      .mockResolvedValueOnce({ total: 6, data: [ASHA] }) // page 1
      .mockResolvedValueOnce({ total: 5, data: [] }) // page 2 is now gone
      .mockResolvedValue({ total: 5, data: [ASHA] });
    const { result } = renderHook(() => useStudents());
    await waitFor(() => expect(result.current.totalPages).toBe(2));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.page).toBe(1));
  });

  it("changing the department resets to page 1", async () => {
    api.getStudents.mockResolvedValue({ total: 12, data: [ASHA] });
    const { result } = renderHook(() => useStudents());
    await waitFor(() => expect(result.current.totalPages).toBe(3));
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));
    act(() => result.current.changeDepartment("CSE"));
    expect(result.current.page).toBe(1);
    expect(result.current.department).toBe("CSE");
  });
});
