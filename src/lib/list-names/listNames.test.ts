import { describe, it, expect } from "vitest";
import { validateListName, MAX_LIST_NAME_LENGTH } from "./listNames";

describe("validateListName", () => {
  it("trims surrounding whitespace", () => {
    expect(validateListName("  Travel  ")).toEqual({ name: "Travel" });
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(validateListName("   ")).toEqual({ error: "List name is required" });
  });

  it("accepts a name exactly at the limit", () => {
    const name = "a".repeat(MAX_LIST_NAME_LENGTH);
    expect(validateListName(name)).toEqual({ name });
  });

  it("rejects a name over the limit", () => {
    expect(validateListName("a".repeat(MAX_LIST_NAME_LENGTH + 1))).toEqual({
      error: "List name must be 100 characters or fewer",
    });
  });
});
