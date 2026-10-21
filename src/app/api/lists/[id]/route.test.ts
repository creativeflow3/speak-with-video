import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireSession } from "@/lib/authz";
import { deleteList, DefaultListDeleteError, ListNotFoundError } from "@/lib/anki-list";
import { unauthedResponse, makeAuthedUser, routeContext } from "../../testUtils";
import { DELETE } from "./route";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/authz", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/logger", () => ({ log: vi.fn(), logRouteError: vi.fn() }));
vi.mock("@/lib/anki-list", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/anki-list")>()),
  deleteList: vi.fn(),
}));

const LIST_ID = "6f1c2b0e-8a4d-4c1e-9f3a-2b7d5e8c9a10";
const request = new Request(`http://localhost/api/lists/${LIST_ID}`, { method: "DELETE" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSession).mockResolvedValue(makeAuthedUser());
});

describe("DELETE /api/lists/[id]", () => {
  it("returns the 401 from requireSession", async () => {
    const unauthed = unauthedResponse();
    vi.mocked(requireSession).mockResolvedValue(unauthed);

    expect(await DELETE(request, routeContext({ id: LIST_ID }))).toBe(unauthed);
    expect(deleteList).not.toHaveBeenCalled();
  });


  it("deletes the list and returns 204", async () => {
    vi.mocked(deleteList).mockResolvedValue(undefined);

    const res = await DELETE(request, routeContext({ id: LIST_ID }));

    expect(deleteList).toHaveBeenCalledWith("user-1", LIST_ID);
    expect(res.status).toBe(204);
  });

  it("returns 404 for another user's list", async () => {
    vi.mocked(deleteList).mockRejectedValue(new ListNotFoundError());

    const res = await DELETE(request, routeContext({ id: LIST_ID }));

    expect(res.status).toBe(404);
  });

  it("returns 400 for the Default list", async () => {
    vi.mocked(deleteList).mockRejectedValue(new DefaultListDeleteError());

    const res = await DELETE(request, routeContext({ id: LIST_ID }));

    expect(res.status).toBe(400);
  });
});
