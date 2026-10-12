// Feed HTML comes from third-party sites, so only a small allowlist of tags
// and attributes survives. Everything else is unwrapped or dropped.

const KEEP = new Set([
  "a", "b", "blockquote", "br", "code", "del", "em", "figcaption", "figure", "h1", "h2",
  "h3", "h4", "h5", "h6", "hr", "i", "img", "kbd", "li", "mark", "ol", "p", "pre", "s",
  "small", "strong", "sub", "sup", "table", "tbody", "td", "th", "thead", "tr", "u", "ul",
]);

// Removed together with their contents.
const DROP = new Set([
  "script", "style", "iframe", "object", "embed", "form", "input", "button", "select",
  "textarea", "noscript", "template", "svg", "math", "link", "meta", "video", "audio",
  "source", "picture", "canvas",
]);

const safeUrl = (value: string | null, base: string) => {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

const clean = (node: Node, base: string, doc: Document): Node[] => {
  if (node.nodeType === Node.TEXT_NODE) return [doc.createTextNode(node.textContent ?? "")];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROP.has(tag)) return [];
  const children = [...el.childNodes].flatMap((c) => clean(c, base, doc));
  if (!KEEP.has(tag)) return children;

  // Headings in a post sit under the post title, so h1/h2 become h3.
  const outTag = tag === "h1" || tag === "h2" ? "h3" : tag;
  const out = doc.createElement(outTag);
  if (tag === "a") {
    const href = safeUrl(el.getAttribute("href"), base);
    if (!href) return children;
    out.setAttribute("href", href);
    out.setAttribute("target", "_blank");
    out.setAttribute("rel", "noopener noreferrer");
  } else if (tag === "img") {
    const src = safeUrl(el.getAttribute("src") ?? el.getAttribute("data-src"), base);
    if (!src) return [];
    out.setAttribute("src", src);
    out.setAttribute("alt", el.getAttribute("alt") ?? "");
    out.setAttribute("loading", "lazy");
    out.setAttribute("referrerpolicy", "no-referrer");
  } else if (tag === "td" || tag === "th") {
    for (const a of ["colspan", "rowspan"]) {
      const v = el.getAttribute(a);
      if (v && /^\d+$/.test(v)) out.setAttribute(a, v);
    }
  }
  out.append(...children);
  return [out];
};

/** Returns sanitized HTML, or null if nothing readable is left. */
export const sanitizeHtml = (html: string, baseUrl: string): string | null => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out = doc.createElement("div");
  out.append(...[...doc.body.childNodes].flatMap((n) => clean(n, baseUrl, doc)));
  return out.textContent?.trim() || out.querySelector("img") ? out.innerHTML : null;
};

/**
 * Removes an image block at the very top of an article. The reader already
 * shows a cover image, and feeds usually repeat it as the first thing in the
 * body, often from a different URL (resized or CDN copies), so this matches
 * by position rather than by src.
 */
export const dropLeadingImage = (html: string): string => {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html;
  const first = [...root.childNodes].find(
    (n) => n.nodeType === Node.ELEMENT_NODE || n.textContent?.trim()
  );
  if (!(first instanceof Element)) return html;
  const imageOnly =
    first.tagName === "IMG" ||
    (!!first.querySelector("img") &&
      first.querySelectorAll("img").length === 1 &&
      (first.textContent ?? "").trim().length < 200 &&
      !first.querySelector("p, ul, ol, pre, h3, h4, blockquote"));
  if (!imageOnly) return html;
  first.remove();
  return root.innerHTML;
};

export const htmlToText = (html: string) =>
  (new DOMParser().parseFromString(html, "text/html").body.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();

export const firstImage = (html: string, baseUrl: string) => {
  const img = new DOMParser().parseFromString(html, "text/html").querySelector("img");
  return safeUrl(img?.getAttribute("src") ?? null, baseUrl);
};
