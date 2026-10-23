import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { MONO_LABEL, TEXT_LINK } from "@/components/ui/styles";
import { pluralize } from "@/lib/utils";
import type { OwnedVideoJson } from "@/types";
import { formatDate } from "./format";

const STATUS_STYLES: Record<OwnedVideoJson["status"], { label: string; className: string }> = {
  pending: { label: "Processing", className: "border-accent text-ink" },
  succeeded: { label: "Ready", className: "border-success text-success" },
  failed: { label: "Failed", className: "border-danger text-danger" },
};

function languageName(code: string) {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.native ?? code;
}

export function VideoRow({ video }: { video: OwnedVideoJson }) {
  const status = STATUS_STYLES[video.status];
  const details = [
    video.channel,
    languageName(video.language),
    video.chunkCount ? pluralize(video.chunkCount, "chunk") : null,
    video.visibility === "base" ? "Shared library" : "Private",
    `Added ${formatDate(new Date(video.createdAt))}`,
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
