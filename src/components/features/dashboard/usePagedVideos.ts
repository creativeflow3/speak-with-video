"use client";

import { useEffect, useState } from "react";
import type { PageSize } from "@/lib/pagination";
import type { VideosPageResponse } from "@/types";
import { NETWORK_ERROR, errorMessageFor } from "../apiErrors";

interface PagedVideos {
  /** The last page that loaded — kept while the next one is fetched, so the list doesn't flash empty. */
  data: VideosPageResponse | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/** Fetches one page of the user's videos from /api/videos, refetching whenever `page` or `limit` changes. */
export function usePagedVideos(page: number, limit: PageSize): PagedVideos {
  const [data, setData] = useState<VideosPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/videos?page=${page}&limit=${limit}`, { signal: controller.signal });
        if (!res.ok) setError(await errorMessageFor(res));
        else setData((await res.json()) as VideosPageResponse);
      } catch {
        if (!controller.signal.aborted) setError(NETWORK_ERROR);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [page, limit, attempt]);

  return { data, loading, error, retry: () => setAttempt((n) => n + 1) };
}
