import { z } from "zod";

// Client-safe (no db import) so the API route and the pager share one set of rules.
export const PAGE_SIZES = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;

export interface PageParams {
  page: number;
  limit: PageSize;
}

export const PAGE_PARAMS_ERROR = `page must be a whole number of 1 or more, and limit one of ${PAGE_SIZES.join(", ")}`;

const pageParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().pipe(z.literal(PAGE_SIZES)).default(DEFAULT_PAGE_SIZE),
});

/** Reads `page` and `limit` from a query string, defaulting whichever is missing. */
export function parsePageParams(searchParams: URLSearchParams): PageParams | { error: string } {
  const parsed = pageParamsSchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  return parsed.success ? parsed.data : { error: PAGE_PARAMS_ERROR };
}

/** How many pages `total` items fill; an empty result is still one (empty) page. */
export function totalPagesFor(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}

export const PAGE_GAP = "…";

/** The pager's buttons: first, last, and the current page ±1, with a gap marker where pages are skipped. */
export function pageNumbers(current: number, totalPages: number): (number | typeof PAGE_GAP)[] {
  const shown = new Set([1, totalPages, current - 1, current, current + 1]);
  const pages = [...shown].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  return pages.flatMap((page, i) => {
    const previous = pages[i - 1];
    if (previous === undefined || page - previous === 1) return [page];
    // A gap of exactly one page shows that page instead of an ellipsis standing in for it.
    return page - previous === 2 ? [previous + 1, page] : [PAGE_GAP, page];
  });
}
