// Chrome serves cached favicons to extensions with the "favicon" permission,
// so no request goes to a third-party favicon service. Elsewhere callers show a letter.
export const faviconUrl = (pageUrl: string, size = 32) =>
  location.protocol === "chrome-extension:"
    ? `/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`
    : null;
