import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/authz";
import { createList, listLists } from "@/lib/anki-list";
import { log } from "@/lib/logger";
import { listErrorResponse } from "./routeHelpers";

const createListSchema = z.object({ name: z.string() });

export async function GET() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({ lists: await listLists(auth.id) });
  } catch (err) {
    return listErrorResponse(err, "GET /api/lists");
  }
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const parsed = createListSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Request body must be JSON with a name" }, { status: 400 });
  }

  try {
    const list = await createList(auth.id, parsed.data.name);
    log("list_created", { userId: auth.id, listId: list.id });
    return NextResponse.json({ list }, { status: 201 });
  } catch (err) {
    return listErrorResponse(err, "POST /api/lists");
  }
}
