import { NextResponse } from "next/server";
import {
  DefaultListDeleteError,
  DuplicateListNameError,
  InvalidListNameError,
  ListNotFoundError,
} from "@/lib/anki-list";
import { logRouteError } from "@/lib/logger";

// Someone else's list maps to 404 (not 403), so the response doesn't confirm it exists.
const ERROR_STATUS: [new (...args: never[]) => Error, number][] = [
  [ListNotFoundError, 404],
  [DuplicateListNameError, 409],
  [InvalidListNameError, 400],
  [DefaultListDeleteError, 400],
];

/** Maps the anki-list domain errors to HTTP responses; anything else is logged and becomes a 500. */
export function listErrorResponse(err: unknown, route: string): NextResponse {
  const match = ERROR_STATUS.find(([ErrorClass]) => err instanceof ErrorClass);
  if (match) return NextResponse.json({ error: (err as Error).message }, { status: match[1] });

  logRouteError(route, err);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
}
