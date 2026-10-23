import { describe, it, expect } from "vitest";
import { PAGE_PARAMS_ERROR, pageNumbers, parsePageParams, totalPagesFor } from "./pagination";

const params = (query: string) => parsePageParams(new URLSearchParams(query));

describe("parsePageParams", () => {
  it("defaults to page 1 with 10 per page", () => {
    expect(params("")).toEqual({ page: 1, limit: 10 });
  });

  it("reads a valid page and limit", () => {
    expect(params("page=3&limit=25")).toEqual({ page: 3, limit: 25 });
    expect(params("limit=50")).toEqual({ page: 1, limit: 50 });
  });

  it.each(["limit=7", "limit=abc", "page=0", "page=-1", "page=1.5", "page=abc"])("rejects %s", (query) => {
    expect(params(query)).toEqual({ error: PAGE_PARAMS_ERROR });
  });
});

describe("totalPagesFor", () => {
  it("rounds up, and counts an empty result as one page", () => {
    expect(totalPagesFor(0, 10)).toBe(1);
    expect(totalPagesFor(10, 10)).toBe(1);
    expect(totalPagesFor(11, 10)).toBe(2);
    expect(totalPagesFor(115, 25)).toBe(5);
  });
});

describe("pageNumbers", () => {
  it("shows a single page", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
  });

  it("shows every page when there are few", () => {
    expect(pageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses gaps around the current page", () => {
    expect(pageNumbers(1, 12)).toEqual([1, 2, "…", 12]);
    expect(pageNumbers(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
    expect(pageNumbers(12, 12)).toEqual([1, "…", 11, 12]);
  });

  it("fills a one-page gap with the page instead of an ellipsis", () => {
    expect(pageNumbers(4, 12)).toEqual([1, 2, 3, 4, 5, "…", 12]);
  });
});
