const VIDEO_ID_RE = /^[\w-]{11}$/;
const YOUTUBE_HOSTNAMES = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

function isYouTubeHostname(hostname: string): boolean {
  return hostname === "youtu.be" || YOUTUBE_HOSTNAMES.has(hostname);
}

/** True for a bare 11-character video ID or a URL on a real YouTube hostname (exact match, not just a suffix). */
export function isYouTubeUrl(input: string): boolean {
  const trimmed = input.trim();
  if (VIDEO_ID_RE.test(trimmed)) return true;
  try {
    return isYouTubeHostname(new URL(trimmed).hostname);
  } catch {
    return false;
  }
}

/** Extract the 11-character YouTube video ID from any common URL shape, or a bare ID. */
export function parseVideoId(input: string): string | null {
  const trimmed = input.trim();

  // Bare video ID
  if (VIDEO_ID_RE.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1);
      return VIDEO_ID_RE.test(id) ? id : null;
    }
    if (YOUTUBE_HOSTNAMES.has(url.hostname)) {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id && VIDEO_ID_RE.test(id) ? id : null;
      }
      const shortsMatch = url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})/);
      if (shortsMatch) return shortsMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

export interface OEmbedResult {
  title: string;
  channel: string;
}

/** Free, keyless YouTube metadata lookup. Returns null on any failure — caller falls back to manual fields. */
export async function fetchOEmbed(youtubeUrl: string): Promise<OEmbedResult | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; author_name?: string };
    if (!data.title) return null;
    return { title: data.title, channel: data.author_name ?? "" };
  } catch {
    return null;
  }
}

export function youtubeUrlFromId(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function deepLinkUrl(videoId: string, startTime: number): string {
  return `https://youtu.be/${videoId}?t=${Math.floor(startTime)}`;
}
