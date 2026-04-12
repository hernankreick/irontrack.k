export const getYTVideoId = (url) => {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  try {
    if (u.includes("youtube.com/embed/")) return u.split("embed/")[1].split("?")[0].split("&")[0];
    if (u.includes("youtu.be/")) return u.split("youtu.be/")[1].split("?")[0].split("&")[0];
    if (u.includes("shorts/")) return u.split("shorts/")[1].split("?")[0].split("&")[0];
    if (u.includes("v=")) return u.split("v=")[1].split("&")[0];
  } catch (e) {}
  return null;
};
