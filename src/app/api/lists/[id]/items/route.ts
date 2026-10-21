import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { clearListItems, listItems } from "@/lib/anki-list";
import { log } from "@/lib/logger";
import { listErrorResponse } from "../../routeHelpers";

type ListItemsContext = RouteContext<"/api/lists/[id]/items">;

export async function GET(_request: Request, { params }: ListItemsContext) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    return NextResponse.json({ items: await listItems(auth.id, id) });
  } catch (err) {
    return listErrorResponse(err, "GET /api/lists/[id]/items");
  }
}

/** Clears every word — the only way to empty the Default list, which can't be deleted. */
export async function DELETE(_request: Request, { params }: ListItemsContext) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const cleared = await clearListItems(auth.id, id);
    log("list_cleared", { userId: auth.id, listId: id, cleared });
    return NextResponse.json({ cleared });
  } catch (err) {
    return listErrorResponse(err, "DELETE /api/lists/[id]/items");
  }
}
