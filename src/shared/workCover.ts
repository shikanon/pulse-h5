import type { Work } from "./api";
export const coverMediaTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
];
export function coverSource(work: Work) {
  if (!work.cover || !["image", "video"].includes(work.cover.kind))
    return undefined;
  // Only the work-scoped, authorized media route is allowed; never embed arbitrary URLs.
  return `/api/v1/works/${encodeURIComponent(work.id)}/cover?asset=${encodeURIComponent(work.cover.assetId)}`;
}
