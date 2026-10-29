import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import useDebounce from "../../src/hooks/useDebounce.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("only updates after the delay", () => {
  const { result, rerender } = renderHook(({ v }) => useDebounce(v, 250), {
    initialProps: { v: "a" },
  });
  rerender({ v: "ab" });
  expect(result.current).toBe("a");
  act(() => vi.advanceTimersByTime(249));
  expect(result.current).toBe("a");
  act(() => vi.advanceTimersByTime(1));
  expect(result.current).toBe("ab");
});

it("restarts the wait when the value keeps changing", () => {
  const { result, rerender } = renderHook(({ v }) => useDebounce(v, 250), {
    initialProps: { v: "a" },
  });
  rerender({ v: "ab" });
  act(() => vi.advanceTimersByTime(200));
  rerender({ v: "abc" });
  act(() => vi.advanceTimersByTime(200));
  expect(result.current).toBe("a");
  act(() => vi.advanceTimersByTime(50));
  expect(result.current).toBe("abc");
});
