import { describe, it, expect, vi, beforeEach } from "vitest";
import { ankiList, ankiListItems } from "@/db/schema";
import { addListItem, downloadAndClearList } from "./items";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  insertItemsValues: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("@/db", () => ({ db: mocks }));

function selectChain(rows: { id: string }[]) {
  return { from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }) };
}

function insertListChain(rows: { id: string }[]) {
  return { values: () => ({ onConflictDoNothing: () => ({ returning: () => Promise.resolve(rows) }) }) };
}

const insertItemsChain = { values: mocks.insertItemsValues };

function updateItemsChain(rows: { front: string; back: string; notes: string | null }[]) {
  return { set: () => ({ where: () => ({ returning: () => Promise.resolve(rows) }) }) };
}

function updateListChain() {
  return { set: () => ({ where: () => Promise.resolve(undefined) }) };
}

beforeEach(() => {
  mocks.select.mockReset();
  mocks.insert.mockReset();
  mocks.update.mockReset();
  mocks.transaction.mockReset();
  mocks.insertItemsValues.mockClear();
});

describe("addListItem", () => {
  it("adds the card to the existing active list", async () => {
    mocks.select.mockReturnValue(selectChain([{ id: "list-1" }]));
    mocks.insert.mockReturnValue(insertItemsChain);

    await addListItem("user-1", { front: "vale la pena", back: "it's worth it" });

    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledWith(ankiListItems);
    expect(mocks.insertItemsValues).toHaveBeenCalledWith({
      ankiListId: "list-1",
      front: "vale la pena",
      back: "it's worth it",
      notes: null,
    });
  });

  it("defaults notes to null when not provided, and passes it through when given", async () => {
    mocks.select.mockReturnValue(selectChain([{ id: "list-1" }]));
    mocks.insert.mockReturnValue(insertItemsChain);

    await addListItem("user-1", { front: "hola", back: "hi", notes: "ep 3" });

    expect(mocks.insertItemsValues).toHaveBeenCalledWith(expect.objectContaining({ notes: "ep 3" }));
  });

  it("creates a new active list when none exists, then adds the card to it", async () => {
    mocks.select.mockReturnValue(selectChain([]));
    mocks.insert.mockImplementation((table) =>
      table === ankiList ? insertListChain([{ id: "list-new" }]) : insertItemsChain,
    );

    await addListItem("user-1", { front: "hola", back: "hi" });

    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert).toHaveBeenCalledWith(ankiList);
    expect(mocks.insert).toHaveBeenCalledWith(ankiListItems);
    expect(mocks.insertItemsValues).toHaveBeenCalledWith(
      expect.objectContaining({ ankiListId: "list-new" }),
    );
  });

  it("falls back to the winning row when it loses the create-list race", async () => {
    mocks.select
      .mockReturnValueOnce(selectChain([])) // no active list yet
      .mockReturnValueOnce(selectChain([{ id: "list-winner" }])); // re-lookup after a lost conflict
    mocks.insert.mockImplementation((table) =>
      table === ankiList ? insertListChain([]) : insertItemsChain,
    );

    await addListItem("user-1", { front: "hola", back: "hi" });

    expect(mocks.select).toHaveBeenCalledTimes(2);
    expect(mocks.insertItemsValues).toHaveBeenCalledWith(
      expect.objectContaining({ ankiListId: "list-winner" }),
    );
  });
});

describe("downloadAndClearList", () => {
  beforeEach(() => {
    mocks.transaction.mockImplementation((callback: (tx: typeof mocks) => unknown) => callback(mocks));
  });

  it("returns an empty array without updating anything when there is no active list", async () => {
    mocks.select.mockReturnValue(selectChain([]));

    const result = await downloadAndClearList("user-1");

    expect(result).toEqual([]);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("marks the active list and its items deleted, and returns the exported cards", async () => {
    mocks.select.mockReturnValue(selectChain([{ id: "list-1" }]));
    mocks.update.mockImplementation((table) =>
      table === ankiListItems
        ? updateItemsChain([
            { front: "vale la pena", back: "it's worth it", notes: null },
            { front: "de nada", back: "you're welcome", notes: "ep 3" },
          ])
        : updateListChain(),
    );

    const result = await downloadAndClearList("user-1");

    expect(result).toEqual([
      { front: "vale la pena", back: "it's worth it", notes: undefined },
      { front: "de nada", back: "you're welcome", notes: "ep 3" },
    ]);
    expect(mocks.update).toHaveBeenCalledWith(ankiListItems);
    expect(mocks.update).toHaveBeenCalledWith(ankiList);
  });
});
