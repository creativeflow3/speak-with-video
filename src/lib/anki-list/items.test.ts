import { describe, it, expect, vi, beforeEach } from "vitest";
import { ankiListItems } from "@/db/schema";
import { addListItem, clearListItems, deleteListItem, exportList, getListWithItems, listItems } from "./items";
import { getList, resolveListForUser, ListNotFoundError } from "./lists";
import { argsOf, queryChain } from "./testUtils";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/db", () => ({ db: mocks }));
vi.mock("./lists", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lists")>()),
  getList: vi.fn(),
  resolveListForUser: vi.fn(),
}));

const TRAVEL_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "44444444-4444-4444-8444-444444444444";

const travelList = { id: TRAVEL_ID, name: "Travel", isDefault: false };
const holaRow = { id: ITEM_ID, front: "hola", back: "hi", notes: null };
const holaItem = { id: ITEM_ID, front: "hola", back: "hi", notes: undefined };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getList).mockResolvedValue(travelList);
  vi.mocked(resolveListForUser).mockResolvedValue(travelList);
  mocks.select.mockReturnValue(queryChain([])); // also builds the owned-list subqueries
});

describe("addListItem", () => {
  it("adds the card to the resolved list and returns that list", async () => {
    const insert = queryChain(undefined);
    mocks.insert.mockReturnValue(insert);

    const list = await addListItem("user-1", { front: "vale la pena", back: "it's worth it" }, TRAVEL_ID);

    expect(resolveListForUser).toHaveBeenCalledWith("user-1", TRAVEL_ID);
    expect(mocks.insert).toHaveBeenCalledWith(ankiListItems);
    expect(argsOf(insert, "values")).toEqual([
      { ankiListId: TRAVEL_ID, front: "vale la pena", back: "it's worth it", notes: null },
    ]);
    expect(list).toEqual(travelList);
  });

  it("passes notes through when given", async () => {
    const insert = queryChain(undefined);
    mocks.insert.mockReturnValue(insert);

    await addListItem("user-1", { front: "hola", back: "hi", notes: "ep 3" });

    expect(argsOf(insert, "values")).toEqual([expect.objectContaining({ notes: "ep 3" })]);
  });
});

describe("getListWithItems / listItems", () => {
  it("returns the list alongside its words, mapping null notes to undefined", async () => {
    mocks.select.mockReturnValue(queryChain([holaRow, { ...holaRow, id: OTHER_ID, notes: "ep 3" }]));

    await expect(getListWithItems("user-1", TRAVEL_ID)).resolves.toEqual({
      list: travelList,
      items: [holaItem, { ...holaItem, id: OTHER_ID, notes: "ep 3" }],
    });
  });

  it("rejects when the user doesn't own the list", async () => {
    vi.mocked(getList).mockRejectedValue(new ListNotFoundError());

    await expect(listItems("user-1", OTHER_ID)).rejects.toBeInstanceOf(ListNotFoundError);
  });

  it("rejects a malformed id without querying", async () => {
    await expect(getListWithItems("user-1", "not-a-uuid")).rejects.toBeInstanceOf(ListNotFoundError);
    expect(mocks.select).not.toHaveBeenCalled();
  });
});

describe("deleteListItem", () => {
  it("returns true when a word was soft-deleted", async () => {
    mocks.update.mockReturnValue(queryChain([{ id: ITEM_ID }]));

    await expect(deleteListItem("user-1", TRAVEL_ID, ITEM_ID)).resolves.toBe(true);
    expect(mocks.update).toHaveBeenCalledWith(ankiListItems);
  });

  it("returns false when nothing matched (wrong owner, wrong list, or already removed)", async () => {
    mocks.update.mockReturnValue(queryChain([]));

    await expect(deleteListItem("user-1", TRAVEL_ID, ITEM_ID)).resolves.toBe(false);
  });

  it("returns false for malformed ids without writing", async () => {
    await expect(deleteListItem("user-1", TRAVEL_ID, "nope")).resolves.toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("clearListItems", () => {
  it("soft-deletes every word in one owned-list update and returns how many", async () => {
    mocks.update.mockReturnValue(queryChain([{ id: "a" }, { id: "b" }]));

    await expect(clearListItems("user-1", TRAVEL_ID)).resolves.toBe(2);
    expect(getList).not.toHaveBeenCalled();
  });

  it("returns 0 for an owned list that was already empty", async () => {
    mocks.update.mockReturnValue(queryChain([]));

    await expect(clearListItems("user-1", TRAVEL_ID)).resolves.toBe(0);
    expect(getList).toHaveBeenCalledWith("user-1", TRAVEL_ID);
  });

  it("rejects when nothing was cleared because the user doesn't own the list", async () => {
    mocks.update.mockReturnValue(queryChain([]));
    vi.mocked(getList).mockRejectedValue(new ListNotFoundError());

    await expect(clearListItems("user-1", OTHER_ID)).rejects.toBeInstanceOf(ListNotFoundError);
  });
});

describe("exportList", () => {
  it("returns the resolved list and its cards without clearing anything", async () => {
    mocks.select.mockReturnValue(queryChain([holaRow]));

    const result = await exportList("user-1", TRAVEL_ID);

    expect(resolveListForUser).toHaveBeenCalledWith("user-1", TRAVEL_ID);
    expect(result).toEqual({ list: travelList, cards: [holaItem] });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
