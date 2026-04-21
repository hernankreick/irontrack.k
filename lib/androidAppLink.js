/**
 * URL pública de la app Android (Google Play, TWA o APK).
 * Definí `VITE_ANDROID_APP_URL` en `.env` / `.env.local` antes del build.
 */
export function getAndroidAppDownloadUrl() {
  try {
    var v = import.meta.env && import.meta.env.VITE_ANDROID_APP_URL;
    if (typeof v === "string" && v.trim().length) return v.trim();
  } catch (e) {}
  return "";
}
