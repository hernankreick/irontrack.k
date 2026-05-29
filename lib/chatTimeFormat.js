const ISO_WITHOUT_TIMEZONE_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
const TIMEZONE_SUFFIX_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

function parseChatTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const raw = String(value).trim();
  const normalized =
    ISO_WITHOUT_TIMEZONE_RE.test(raw) && !TIMEZONE_SUFFIX_RE.test(raw)
      ? raw.replace(" ", "T") + "Z"
      : raw;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatChatTime(value) {
  const date = parseChatTimestamp(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
