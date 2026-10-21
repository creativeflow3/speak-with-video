import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireSession } from "@/lib/authz";
import { deleteListItem } from "@/lib/anki-list";
import { unauthedResponse, makeAuthedUser, routeContext } from "../../../../testUtils";
import { DELETE } from "./route";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/authz", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/logger", () => ({ log: vi.fn(), logRouteError: vi.fn() }));
vi.mock("@/lib/anki-list", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/anki-list")>()),
  deleteListItem: vi.fn(),
}));

const LIST_ID = "6f1c2b0e-8a4d-4c1e-9f3a-2b7d5e8c9a10";
const ITEM_ID = "0b9e7d6c-5a4f-4e3d-8c2b-1a0f9e8d7c6b";
const request = new Request(`http://localhost/api/lists/${LIST_ID}/items/${ITEM_ID}`, { method: "DELETE" });
const ids = { id: LIST_ID, itemId: ITEM_ID };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSession).mockResolvedValue(makeAuthedUser());
});

describe("DELETE /api/lists/[id]/items/[itemId]", () => {
  it("returns the 401 from requireSession", async () => {
    const unauthed = unauthedResponse();
    vi.mocked(requireSession).mockResolvedValue(unauthed);

    expect(await DELETE(request, routeContext(ids))).toBe(unauthed);
  });


  it("removes the word and returns 204", async () => {
    vi.mocked(deleteListItem).mockResolvedValue(true);

    const res = await DELETE(request, routeContext(ids));

    expect(deleteListItem).toHaveBeenCalledWith("user-1", LIST_ID, ITEM_ID);
    expect(res.status).toBe(204);
  });

  it("returns 404 when the word isn't in a list the user owns", async () => {
    vi.mocked(deleteListItem).mockResolvedValue(false);

    const res = await DELETE(request, routeContext(ids));

    expect(res.status).toBe(404);
  });
});
