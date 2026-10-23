import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { parsePageParams, totalPagesFor, type PageParams } from "@/lib/pagination";
import { listOwnedVideosPage } from "@/services/ingest.service";
import { serverErrorResponse } from "../serverError";

/**
 * One page of the user's videos, plus the total. A page past the end (videos removed since the
 * client last looked) is served as the last page, and `page` in the response says which was served.
 */
async function loadPage(ownerId: string, params: PageParams) {
  const result = await listOwnedVideosPage(ownerId, params);
  const totalPages = totalPagesFor(result.total, params.limit);
  if (params.page <= totalPages) return { ...result, ...params, totalPages };

  const lastPage = { ...params, page: totalPages };
  return { ...(await listOwnedVideosPage(ownerId, lastPage)), ...lastPage, totalPages };
}

/** One page of the signed-in user's videos: `?page=` (from 1) and `?limit=` (10, 25 or 50). */
export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const params = parsePageParams(new URL(request.url).searchParams);
  if ("error" in params) {
    return NextResponse.json({ error: params.error }, { status: 400 });
  }

  try {
    // Serialises to VideosPageResponse (`@/types`); Dates become ISO strings.
    return NextResponse.json(await loadPage(auth.id, params));
  } catch (err) {
    return serverErrorResponse("GET /api/videos", err);
  }
}
