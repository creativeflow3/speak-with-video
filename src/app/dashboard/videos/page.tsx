import type { Metadata } from "next";
import Link from "next/link";
import { getDashboardUser } from "@/lib/authz";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { listOwnedVideos, type OwnedVideo } from "@/services/ingest.service";
import { MONO_LABEL, TEXT_LINK } from "@/components/ui/styles";
import { DashboardPageHeader } from "@/components/layout/DashboardPageHeader";
import { pluralize } from "@/lib/utils";
import { formatDate } from "@/components/features/dashboard/format";

export const metadata: Metadata = { title: "Videos" };

const STATUS_STYLES: Record<OwnedVideo["status"], { label: string; className: string }> = {
  pending: { label: "Processing", className: "border-accent text-ink" },
  succeeded: { label: "Ready", className: "border-success text-success" },
  failed: { label: "Failed", className: "border-danger text-danger" },
};

function languageName(code: string) {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.native ?? code;
}

function VideoRow({ video }: { video: OwnedVideo }) {
  const status = STATUS_STYLES[video.status];
  const details = [
    video.channel,
    languageName(video.language),
    video.chunkCount ? pluralize(video.chunkCount, "chunk") : null,
    video.visibility === "base" ? "Shared library" : "Private",
    `Added ${formatDate(video.createdAt)}`,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <a
          href={video.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`min-w-0 break-words text-base font-medium text-ink ${TEXT_LINK}`}
        >
          {video.title || video.youtubeUrl}
        </a>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${status.className}`}>
          {status.label}
        </span>
      </div>
      <p className={MONO_LABEL}>{details.join(" · ")}</p>
      {video.status === "failed" && video.failureReason && (
        <p className="break-words text-sm text-danger">{video.failureReason}</p>
      )}
    </li>
  );
}

export default async function VideosPage() {
  const user = await getDashboardUser("/dashboard/videos");
  const videos = await listOwnedVideos(user.id);

  return (
    <div className="flex flex-col gap-6">
      <DashboardPageHeader
        title="Videos"
        description="Videos you added. A video someone else added first stays in their list, even if you submitted it too."
      />
      {videos.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          No videos yet —{" "}
          <Link href="/" className={`text-ink underline ${TEXT_LINK}`}>
            add one from the home page
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {videos.map((video) => (
            <VideoRow key={video.id} video={video} />
          ))}
        </ul>
      )}
    </div>
  );
}
