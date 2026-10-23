"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { MONO_LABEL, SELECT_INPUT, TEXT_LINK } from "@/components/ui/styles";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, type PageSize } from "@/lib/pagination";
import type { VideosPageResponse } from "@/types";
import { ActionError } from "./ActionError";
import { VideoRow } from "./VideoRow";
import { usePagedVideos } from "./usePagedVideos";

function PerPageSelect({ value, onChange }: { value: PageSize; onChange: (size: PageSize) => void }) {
  return (
    <div className={`flex items-center justify-end gap-3 ${MONO_LABEL}`}>
      <label htmlFor="videos-per-page">Per page</label>
      <select
        id="videos-per-page"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as PageSize)}
        className={SELECT_INPUT}
      >
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyState() {
  return (
    <p className="py-10 text-center text-sm text-muted">
      No videos yet —{" "}
      <Link href="/" className={`text-ink underline ${TEXT_LINK}`}>
        add one from the home page
      </Link>
      .
    </p>
  );
}

function shownRange({ page, limit, total, videos }: VideosPageResponse) {
  const first = (page - 1) * limit + 1;
  return `Showing ${first}–${first + videos.length - 1} of ${total}`;
}

function VideoPage({ data, loading, onPageChange }: { data: VideosPageResponse; loading: boolean; onPageChange: (page: number) => void }) {
  return (
    <>
      <ul aria-busy={loading} className={`divide-y divide-line transition-opacity ${loading ? "opacity-60" : ""}`}>
        {data.videos.map((video) => (
          <VideoRow key={video.id} video={video} />
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className={MONO_LABEL}>{shownRange(data)}</p>
        <Pagination page={data.page} totalPages={data.totalPages} onPageChange={onPageChange} />
      </div>
    </>
  );
}

/** The user's videos, a page at a time from /api/videos, with a per-page picker and pager. */
export function VideoList() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const { data, loading, error, retry } = usePagedVideos(page, limit);
  const topRef = useRef<HTMLDivElement>(null);

  // The pager follows `data.page`, not `page`: past the end, the API serves (and reports) the last page.
  function changePage(next: number) {
    setPage(next);
    topRef.current?.scrollIntoView({ block: "start" });
  }

  function changeLimit(size: PageSize) {
    setLimit(size);
    setPage(1);
  }

  return (
    <div ref={topRef} className="flex flex-col gap-4">
      <PerPageSelect value={limit} onChange={changeLimit} />
      {error && (
        <div className="flex items-center gap-3">
          <ActionError error={error} />
          <Button variant="secondary" onClick={retry}>
            Retry
          </Button>
        </div>
      )}
      {!data && loading && <p role="status" className="py-10 text-center text-sm text-muted">Loading videos…</p>}
      {data && data.total === 0 && <EmptyState />}
      {data && data.total > 0 && <VideoPage data={data} loading={loading} onPageChange={changePage} />}
    </div>
  );
}
