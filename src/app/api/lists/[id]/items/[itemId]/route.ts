import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { deleteListItem } from "@/lib/anki-list";
import { log } from "@/lib/logger";
import { listErrorResponse } from "../../../routeHelpers";

export async function DELETE(_request: Request, { params }: RouteContext<"/api/lists/[id]/items/[itemId]">) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const { id, itemId } = await params;
  try {
    const removed = await deleteListItem(auth.id, id, itemId);
    if (!removed) return NextResponse.json({ error: "Word not found" }, { status: 404 });
    log("list_item_deleted", { userId: auth.id, listId: id, itemId });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return listErrorResponse(err, "DELETE /api/lists/[id]/items/[itemId]");
  }
}
