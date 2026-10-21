import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireSession } from "@/lib/authz";
import { clearListItems, listItems, ListNotFoundError } from "@/lib/anki-list";
import { unauthedResponse, makeAuthedUser, routeContext } from "../../../testUtils";
import { DELETE, GET } from "./route";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/authz", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/logger", () => ({ log: vi.fn(), logRouteError: vi.fn() }));
vi.mock("@/lib/anki-list", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/anki-list")>()),
  listItems: vi.fn(),
  clearListItems: vi.fn(),
}));

const LIST_ID = "6f1c2b0e-8a4d-4c1e-9f3a-2b7d5e8c9a10";
const request = new Request(`http://localhost/api/lists/${LIST_ID}/items`);
const unauthed = unauthedResponse();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSession).mockResolvedValue(makeAuthedUser());
});

describe("GET /api/lists/[id]/items", () => {
  it("returns the 401 from requireSession", async () => {
    vi.mocked(requireSession).mockResolvedValue(unauthed);

    expect(await GET(request, routeContext({ id: LIST_ID }))).toBe(unauthed);
  });


  it("returns the list's words", async () => {
    const items = [{ id: "i1", front: "hola", back: "hi" }];
    vi.mocked(listItems).mockResolvedValue(items);

    const res = await GET(request, routeContext({ id: LIST_ID }));

    expect(listItems).toHaveBeenCalledWith("user-1", LIST_ID);
    expect(await res.json()).toEqual({ items });
  });

  it("returns 404 for another user's list", async () => {
    vi.mocked(listItems).mockRejectedValue(new ListNotFoundError());

    const res = await GET(request, routeContext({ id: LIST_ID }));

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/lists/[id]/items", () => {
  it("returns the 401 from requireSession", async () => {
    vi.mocked(requireSession).mockResolvedValue(unauthed);

    expect(await DELETE(request, routeContext({ id: LIST_ID }))).toBe(unauthed);
    expect(clearListItems).not.toHaveBeenCalled();
  });

  it("clears every word and reports how many", async () => {
    vi.mocked(clearListItems).mockResolvedValue(3);

    const res = await DELETE(request, routeContext({ id: LIST_ID }));

    expect(clearListItems).toHaveBeenCalledWith("user-1", LIST_ID);
    expect(await res.json()).toEqual({ cleared: 3 });
  });

  it("returns 404 for another user's list", async () => {
    vi.mocked(clearListItems).mockRejectedValue(new ListNotFoundError());

    const res = await DELETE(request, routeContext({ id: LIST_ID }));

    expect(res.status).toBe(404);
  });
});
