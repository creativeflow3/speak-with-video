import { NextResponse } from "next/server";
import { logRouteError } from "@/lib/logger";

/** Logs an unexpected route failure and returns the generic 500 the client shows as-is. */
export function serverErrorResponse(route: string, err: unknown): NextResponse {
  logRouteError(route, err);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
}
