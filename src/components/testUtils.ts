import { afterEach, beforeEach, vi } from "vitest";

/** Stubs global fetch for a test file, resetting it before/after every test. */
export function mockFetch() {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });
  return fetchMock;
}
