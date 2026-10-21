import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { deleteList } from "@/lib/anki-list";
import { log } from "@/lib/logger";
import { listErrorResponse } from "../routeHelpers";

export async function DELETE(_request: Request, { params }: RouteContext<"/api/lists/[id]">) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    await deleteList(auth.id, id);
    log("list_deleted", { userId: auth.id, listId: id });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return listErrorResponse(err, "DELETE /api/lists/[id]");
  }
}
