/**
 * Extracts YouTube video id from common URL shapes (watch, embed, shorts, youtu.be, mobile).
 */
export const getYTVideoId = (url) => {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  try {
    if (u.includes("youtube.com/embed/")) return u.split("embed/")[1].split("?")[0].split("&")[0];
    if (u.includes("youtu.be/")) return u.split("youtu.be/")[1].split("?")[0].split("&")[0];
    if (u.includes("/shorts/")) return u.split("shorts/")[1].split("?")[0].split("&")[0];
    if (u.includes("v=")) return u.split("v=")[1].split("&")[0].split("#")[0];
  } catch (e) {}
  return null;
};

/** Canonical embed URL for iframe (avoids stale src when videoId changes). */
export function getYoutubeEmbedSrc(videoId) {
  if (!videoId || typeof videoId !== "string") return "";
  const id = String(videoId).trim();
  if (!id) return "";
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
}
