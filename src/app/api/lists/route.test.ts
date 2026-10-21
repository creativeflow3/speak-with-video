import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireSession } from "@/lib/authz";
import { createList, listLists, DuplicateListNameError, InvalidListNameError } from "@/lib/anki-list";
import { logRouteError } from "@/lib/logger";
import { unauthedResponse, makeAuthedUser, makeJsonRequest } from "../testUtils";
import { GET, POST } from "./route";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/authz", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/logger", () => ({ log: vi.fn(), logRouteError: vi.fn() }));
vi.mock("@/lib/anki-list", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/anki-list")>()),
  listLists: vi.fn(),
  createList: vi.fn(),
}));

const travelList = { id: "list-travel", name: "Travel", isDefault: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSession).mockResolvedValue(makeAuthedUser());
});

describe("GET /api/lists", () => {
  it("returns the 401 from requireSession", async () => {
    const unauthed = unauthedResponse();
    vi.mocked(requireSession).mockResolvedValue(unauthed);

    expect(await GET()).toBe(unauthed);
    expect(listLists).not.toHaveBeenCalled();
  });

  it("returns the user's lists", async () => {
    const lists = [{ ...travelList, itemCount: 2, createdAt: new Date("2026-01-01T00:00:00Z") }];
    vi.mocked(listLists).mockResolvedValue(lists);

    const res = await GET();

    expect(listLists).toHaveBeenCalledWith("user-1");
    expect(await res.json()).toEqual({ lists: [{ ...lists[0], createdAt: "2026-01-01T00:00:00.000Z" }] });
  });

  it("logs and returns a 500 when the lookup fails", async () => {
    const failure = new Error("db down");
    vi.mocked(listLists).mockRejectedValue(failure);

    const res = await GET();

    expect(res.status).toBe(500);
    expect(logRouteError).toHaveBeenCalledWith("GET /api/lists", failure);
  });
});

describe("POST /api/lists", () => {
  it("returns the 401 from requireSession", async () => {
    const unauthed = unauthedResponse();
    vi.mocked(requireSession).mockResolvedValue(unauthed);

    expect(await POST(makeJsonRequest("/api/lists", { name: "Travel" }))).toBe(unauthed);
  });

  it.each([
    ["invalid JSON", "not json"],
    ["a missing name", {}],
    ["a non-string name", { name: 42 }],
  ])("returns 400 for %s", async (_case, body) => {
    const res = await POST(makeJsonRequest("/api/lists", body));

    expect(res.status).toBe(400);
    expect(createList).not.toHaveBeenCalled();
  });

  it("creates the list and returns 201", async () => {
    vi.mocked(createList).mockResolvedValue(travelList);

    const res = await POST(makeJsonRequest("/api/lists", { name: "Travel" }));

    expect(createList).toHaveBeenCalledWith("user-1", "Travel");
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ list: travelList });
  });

  it("returns 409 for a duplicate name", async () => {
    vi.mocked(createList).mockRejectedValue(new DuplicateListNameError("Travel"));

    const res = await POST(makeJsonRequest("/api/lists", { name: "travel" }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'You already have a list named "Travel"' });
  });

  it("returns 400 for an empty or too-long name", async () => {
    vi.mocked(createList).mockRejectedValue(new InvalidListNameError("List name is required"));

    const res = await POST(makeJsonRequest("/api/lists", { name: "  " }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "List name is required" });
  });
});
