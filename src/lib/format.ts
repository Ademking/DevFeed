const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" });

export const timeAgo = (iso: string | null | undefined) => {
  if (!iso) return "";
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 604_800) return rtf.format(Math.round(diff / 86_400), "day");
  if (abs < 2_592_000) return rtf.format(Math.round(diff / 604_800), "week");
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: abs > 31_536_000 ? "numeric" : undefined,
  });
};

export const compact = (n: number) =>
  Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/**
 * True for absolute http(s) addresses. Posts without one (daily.dev text posts,
 * feed items with a missing or relative link) would otherwise open the
 * extension's own chrome-extension:// page, so they're left out of the feed.
 */
export const isWebUrl = (url: string | null | undefined) => {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};

export const hostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const greeting = (date = new Date()) => {
  const h = date.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};
