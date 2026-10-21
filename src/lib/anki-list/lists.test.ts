import { describe, it, expect, vi, beforeEach } from "vitest";
import { ankiList, ankiListItems } from "@/db/schema";
import {
  createList,
  deleteList,
  getList,
  getOrCreateDefaultList,
  listListRefs,
  listLists,
  resolveListForUser,
  DefaultListDeleteError,
  DuplicateListNameError,
  InvalidListNameError,
  ListNotFoundError,
} from "./lists";
import { argsOf, failingChain, queryChain } from "./testUtils";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/db", () => ({ db: mocks }));

const DEFAULT_ID = "11111111-1111-4111-8111-111111111111";
const TRAVEL_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";

const defaultList = { id: DEFAULT_ID, name: "Default", isDefault: true };
const travelList = { id: TRAVEL_ID, name: "Travel", isDefault: false };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation((callback: (tx: typeof mocks) => unknown) => callback(mocks));
});

describe("getOrCreateDefaultList", () => {
  it("returns the existing default list without inserting", async () => {
    mocks.select.mockReturnValue(queryChain([defaultList]));

    await expect(getOrCreateDefaultList("user-1")).resolves.toEqual(defaultList);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("creates a default list named Default when none exists", async () => {
    mocks.select.mockReturnValue(queryChain([]));
    const insert = queryChain([defaultList]);
    mocks.insert.mockReturnValue(insert);

    await expect(getOrCreateDefaultList("user-1")).resolves.toEqual(defaultList);
    expect(mocks.insert).toHaveBeenCalledWith(ankiList);
    expect(argsOf(insert, "values")).toEqual([{ userId: "user-1", ankiListName: "Default", isDefault: true }]);
  });

  it("falls back to the winning row when it loses the create race", async () => {
    mocks.select.mockReturnValueOnce(queryChain([])).mockReturnValueOnce(queryChain([defaultList]));
    mocks.insert.mockReturnValue(queryChain([]));

    await expect(getOrCreateDefaultList("user-1")).resolves.toEqual(defaultList);
    expect(mocks.select).toHaveBeenCalledTimes(2);
  });
});

describe("getList", () => {
  it("returns a list the user owns", async () => {
    mocks.select.mockReturnValue(queryChain([travelList]));

    await expect(getList("user-1", TRAVEL_ID)).resolves.toEqual(travelList);
  });

  it("throws ListNotFoundError for a list the user doesn't own (or that is deleted)", async () => {
    mocks.select.mockReturnValue(queryChain([]));

    await expect(getList("user-1", OTHER_ID)).rejects.toBeInstanceOf(ListNotFoundError);
  });
});

describe("malformed ids", () => {
  it("getList treats a non-uuid id as not found without querying", async () => {
    await expect(getList("user-1", "not-a-uuid")).rejects.toBeInstanceOf(ListNotFoundError);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("resolveListForUser falls back to Default for a non-uuid id", async () => {
    mocks.select.mockReturnValue(queryChain([defaultList]));

    await expect(resolveListForUser("user-1", "not-a-uuid")).resolves.toEqual(defaultList);
    expect(mocks.select).toHaveBeenCalledTimes(1); // only the default lookup
  });
});

describe("listListRefs", () => {
  it("returns just the list refs when the default list exists", async () => {
    mocks.select.mockReturnValue(queryChain([defaultList, travelList]));

    await expect(listListRefs("user-1")).resolves.toEqual([defaultList, travelList]);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("creates the default list on first use and puts it first", async () => {
    mocks.select
      .mockReturnValueOnce(queryChain([travelList])) // refs
      .mockReturnValueOnce(queryChain([])); // findDefaultList
    mocks.insert.mockReturnValue(queryChain([defaultList]));

    await expect(listListRefs("user-1")).resolves.toEqual([defaultList, travelList]);
  });
});

describe("resolveListForUser", () => {
  it("returns the chosen list when the user owns it", async () => {
    mocks.select.mockReturnValue(queryChain([travelList]));

    await expect(resolveListForUser("user-1", TRAVEL_ID)).resolves.toEqual(travelList);
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });

  it("falls back to the default list when the chosen list isn't owned or is gone", async () => {
    mocks.select.mockReturnValueOnce(queryChain([])).mockReturnValueOnce(queryChain([defaultList]));

    await expect(resolveListForUser("user-1", OTHER_ID)).resolves.toEqual(defaultList);
  });

  it("goes straight to the default list when no list is chosen", async () => {
    mocks.select.mockReturnValue(queryChain([defaultList]));

    await expect(resolveListForUser("user-1")).resolves.toEqual(defaultList);
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });
});

describe("listLists", () => {
  const summaries = [
    { ...defaultList, itemCount: 3, createdAt: new Date("2026-01-01") },
    { ...travelList, itemCount: 0, createdAt: new Date("2026-02-01") },
  ];

  it("returns the lists with counts when the default list already exists", async () => {
    mocks.select.mockReturnValue(queryChain(summaries));

    await expect(listLists("user-1")).resolves.toEqual(summaries);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("creates the default list on first use, then re-reads", async () => {
    mocks.select
      .mockReturnValueOnce(queryChain([])) // summaries: nothing yet
      .mockReturnValueOnce(queryChain([])) // findDefaultList inside getOrCreateDefaultList
      .mockReturnValueOnce(queryChain([summaries[0]]));
    mocks.insert.mockReturnValue(queryChain([defaultList]));

    await expect(listLists("user-1")).resolves.toEqual([summaries[0]]);
    expect(mocks.insert).toHaveBeenCalledWith(ankiList);
  });
});

describe("createList", () => {
  beforeEach(() => {
    mocks.select.mockReturnValue(queryChain([defaultList])); // default list already exists
  });

  it("rejects an invalid name before touching the database", async () => {
    await expect(createList("user-1", "   ")).rejects.toBeInstanceOf(InvalidListNameError);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("skips the default-list lookup for an ordinary name", async () => {
    mocks.insert.mockReturnValue(queryChain([travelList]));

    await createList("user-1", "Travel");

    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("makes sure the real Default list exists before a user list could take its name", async () => {
    mocks.insert.mockReturnValue(failingChain(Object.assign(new Error("Failed query"), { cause: { code: "23505" } })));

    await expect(createList("user-1", "default")).rejects.toBeInstanceOf(DuplicateListNameError);
    expect(mocks.select).toHaveBeenCalledTimes(1); // findDefaultList
  });

  it("inserts the trimmed name and returns the new list", async () => {
    const insert = queryChain([travelList]);
    mocks.insert.mockReturnValue(insert);

    await expect(createList("user-1", "  Travel ")).resolves.toEqual(travelList);
    expect(argsOf(insert, "values")).toEqual([{ userId: "user-1", ankiListName: "Travel" }]);
  });

  it("maps a unique-name violation (wrapped by drizzle) to DuplicateListNameError", async () => {
    mocks.insert.mockReturnValue(failingChain(Object.assign(new Error("Failed query"), { cause: { code: "23505" } })));

    await expect(createList("user-1", "Travel")).rejects.toBeInstanceOf(DuplicateListNameError);
  });

  it("rethrows any other database error", async () => {
    const boom = new Error("connection reset");
    mocks.insert.mockReturnValue(failingChain(boom));

    await expect(createList("user-1", "Travel")).rejects.toBe(boom);
  });
});

describe("deleteList", () => {
  it("throws ListNotFoundError and writes nothing for a list the user doesn't own", async () => {
    mocks.select.mockReturnValue(queryChain([]));

    await expect(deleteList("user-1", OTHER_ID)).rejects.toBeInstanceOf(ListNotFoundError);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses to delete the default list", async () => {
    mocks.select.mockReturnValue(queryChain([defaultList]));

    await expect(deleteList("user-1", DEFAULT_ID)).rejects.toBeInstanceOf(DefaultListDeleteError);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("soft-deletes the list and its words in one transaction", async () => {
    mocks.select.mockReturnValue(queryChain([travelList]));
    mocks.update.mockReturnValue(queryChain(undefined));

    await deleteList("user-1", TRAVEL_ID);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(ankiListItems);
    expect(mocks.update).toHaveBeenCalledWith(ankiList);
  });
});
