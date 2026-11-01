// Purpose: Util - src/utils/video.ts (How a video source plays)
//
// One place decides the player: a direct video file runs in a <video> element,
// a YouTube / Vimeo link becomes an embed URL, and any other external page is
// assumed to be embeddable. Blog bodies and the project gallery both ask here,
// so the two cannot drift apart.

/** Direct video files, with any query string / hash still attached. */
const VIDEO_FILE_RE = /\.(?:mp4|webm|ogg|ogv|mov|m4v)(?:[?#].*)?$/i;

const YOUTUBE_RE =
  /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;

const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/i;

export type VideoType = "auto" | "file" | "embed";

/** True for a URL that points at a video file rather than a page. */
export const isVideoFile = (src: string): boolean => VIDEO_FILE_RE.test(src.trim());

/** True when the source is absolute (http, https, …) instead of site-relative. */
export const isExternalUrl = (src: string): boolean =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(src.trim());

/**
 * The URL a video should be embedded with, or null when it should be played
 * as a <video> element instead.
 */
export function videoEmbedUrl(
  src: string,
  type?: VideoType | string,
): string | null {
  const url = src.trim();
  if (!url) return null;
  if (type === "file") return null;

  const youtube = url.match(YOUTUBE_RE);
  if (youtube) {
    return `https://www.youtube-nocookie.com/embed/${youtube[1]}?rel=0`;
  }

  const vimeo = url.match(VIMEO_RE);
  if (vimeo) {
    return `https://player.vimeo.com/video/${vimeo[1]}`;
  }

  if (type === "embed") return url;

  /* Local paths and direct file links play natively. */
  if (VIDEO_FILE_RE.test(url) || !isExternalUrl(url)) {
    return null;
  }

  /* Any other external page is assumed to be embeddable. */
  return url;
}
