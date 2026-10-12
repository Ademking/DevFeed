import type { Post } from "@/lib/api";
import { faviconUrl } from "@/lib/favicon";
import { dropLeadingImage, firstImage, htmlToText, sanitizeHtml } from "@/lib/sanitize";

export interface RssFeed {
  id: string;
  url: string;
  title: string;
  enabled: boolean;
  builtIn?: boolean;
}

const builtIn = (url: string, title: string, enabled = false): RssFeed => ({
  id: url,
  url,
  title,
  enabled,
  builtIn: true,
});

// Every built-in origin is in the manifest's host_permissions.
export const BUILTIN_FEEDS: RssFeed[] = [
  builtIn("https://news.ycombinator.com/rss", "Hacker News", true),
  builtIn("https://web.dev/static/blog/feed.xml", "web.dev", true),
  builtIn("https://github.blog/feed/", "GitHub Blog", true),
  builtIn("https://blog.cloudflare.com/rss/", "Cloudflare Blog", true),
  builtIn("https://dev.to/feed", "DEV Community", true),
  builtIn("https://simonwillison.net/atom/everything/", "Simon Willison"),
  builtIn("https://jvns.ca/atom.xml", "Julia Evans"),
  builtIn("https://martinfowler.com/feed.atom", "Martin Fowler"),
  builtIn("https://overreacted.io/rss.xml", "overreacted"),
  builtIn("https://www.joshwcomeau.com/rss.xml", "Josh W. Comeau"),
  builtIn("https://www.smashingmagazine.com/feed/", "Smashing Magazine"),
  builtIn("https://hacks.mozilla.org/feed/", "Mozilla Hacks"),
  builtIn("https://developer.chrome.com/static/blog/feed.xml", "Chrome for Developers"),
  builtIn("https://react.dev/rss.xml", "React Blog"),
  builtIn("https://devblogs.microsoft.com/typescript/feed/", "TypeScript Blog"),
  builtIn("https://blog.rust-lang.org/feed.xml", "Rust Blog"),
  builtIn("https://go.dev/blog/feed.atom", "Go Blog"),
  builtIn("https://stackoverflow.blog/feed/", "Stack Overflow Blog"),
  builtIn("https://netflixtechblog.com/feed", "Netflix Tech Blog"),
];

// Built-in feeds whose address changed; saved feed lists are updated on read.
const MOVED: Record<string, string> = {
  "https://web.dev/feed.xml": "https://web.dev/static/blog/feed.xml",
};

// Built-in feeds that were dropped; saved lists lose them too (a custom copy stays).
const REMOVED = new Set(["https://lobste.rs/rss"]);

export const migrateFeeds = (feeds: RssFeed[]) =>
  feeds
    .filter((f) => !(f.builtIn && REMOVED.has(f.url)))
    .map((f) => (MOVED[f.url] ? { ...f, id: MOVED[f.url], url: MOVED[f.url] } : f));

const MAX_ITEMS = 30;
const MAX_CONTENT_CHARS = 60_000;
const SUMMARY_CHARS = 320;

// The dev page runs on localhost, which feeds don't allow via CORS, so it goes
// through the Vite proxy. The extension fetches directly via host permissions.
export const fetchFeedXml = async (url: string) => {
  let res: Response;
  try {
    res = await fetch(import.meta.env.DEV ? `/rss-proxy?url=${encodeURIComponent(url)}` : url, {
      // Cookies only trigger bot checks on some sites; feeds are public.
      credentials: "omit",
    });
  } catch {
    // A CORS block and being offline look the same from here.
    throw new Error("no access or offline");
  }
  if (res.status === 403) throw new Error("the site refused the request, HTTP 403");
  if (res.status === 429 || res.status === 419) {
    throw new Error(`rate limited, HTTP ${res.status}; it will retry later`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

const text = (el: Element | null | undefined) => el?.textContent?.trim() ?? "";

// XML namespaces vary by feed; matching on the local name is the reliable path.
const child = (el: Element, ...names: string[]) => {
  for (const c of el.children) {
    if (names.includes(c.localName) || names.includes(c.tagName)) return c;
  }
  return null;
};
const children = (el: Element, name: string) =>
  [...el.children].filter((c) => c.localName === name || c.tagName === name);

const mediaImage = (item: Element) => {
  for (const c of item.children) {
    const url = c.getAttribute("url");
    if (!url) continue;
    if (c.localName === "thumbnail") return url;
    if (c.localName === "content" && c.getAttribute("medium") !== "video") {
      const type = c.getAttribute("type");
      if (!type || type.startsWith("image/")) return url;
    }
    if (c.localName === "enclosure" && c.getAttribute("type")?.startsWith("image/")) return url;
  }
  return null;
};

const atomLink = (entry: Element) => {
  const links = children(entry, "link");
  const alt = links.find((l) => !l.getAttribute("rel") || l.getAttribute("rel") === "alternate");
  return (alt ?? links[0])?.getAttribute("href") ?? "";
};

const readTime = (html: string | null) => {
  if (!html) return null;
  const words = htmlToText(html).split(" ").length;
  return words > 120 ? Math.max(1, Math.round(words / 230)) : null;
};

const summarize = (html: string) => {
  const plain = htmlToText(html);
  // Hacker News puts only a "Comments" link in the description.
  if (plain.length < 25) return null;
  return plain.length > SUMMARY_CHARS ? `${plain.slice(0, SUMMARY_CHARS).trimEnd()}…` : plain;
};

export interface ParsedFeed {
  title: string;
  siteUrl: string;
  posts: Post[];
}

export const parseFeed = (xml: string, feed: Pick<RssFeed, "id" | "url" | "title">): ParsedFeed => {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Not a valid RSS or Atom feed");
  const rootEl = doc.documentElement;
  const isAtom = rootEl.localName === "feed";
  const channel = isAtom ? rootEl : (child(rootEl, "channel") ?? rootEl);
  const entries = isAtom
    ? children(rootEl, "entry")
    : [...children(channel, "item"), ...children(rootEl, "item")];
  if (!entries.length && !child(channel, "title")) {
    throw new Error("Not a valid RSS or Atom feed");
  }

  const title = text(child(channel, "title")) || feed.title || new URL(feed.url).hostname;
  // Some feeds give a relative site link; resolve it against the feed's own address.
  const siteUrl = (() => {
    const raw = (isAtom ? atomLink(rootEl) : text(child(channel, "link"))) || feed.url;
    try {
      return new URL(raw, feed.url).href;
    } catch {
      return feed.url;
    }
  })();
  const sourceImage = faviconUrl(siteUrl);

  const posts = entries.slice(0, MAX_ITEMS).map((item): Post => {
    const link = isAtom ? atomLink(item) : text(child(item, "link")) || text(child(item, "guid"));
    // Items without a link get an empty url and are filtered out of the feed.
    const url = (() => {
      if (!link) return "";
      try {
        return new URL(link, siteUrl).href;
      } catch {
        return "";
      }
    })();
    const fullHtml = text(child(item, "encoded", "content:encoded")) ||
      (isAtom ? text(child(item, "content")) : "");
    const descHtml = text(child(item, "description", "summary"));
    const content = fullHtml ? sanitizeHtml(fullHtml.slice(0, MAX_CONTENT_CHARS), url) : null;
    const date =
      text(child(item, "pubDate", "published", "updated", "date")) || new Date(0).toISOString();
    const parsedDate = new Date(date);
    const iso = Number.isNaN(parsedDate.getTime()) ? new Date(0).toISOString() : parsedDate.toISOString();
    const comments = text(child(item, "comments"));
    const author = text(child(item, "creator", "dc:creator", "author"));
    const categories = children(item, "category")
      .map((c) => c.getAttribute("term") ?? text(c))
      .filter(Boolean)
      .slice(0, 5);

    const image =
      mediaImage(item) ??
      (fullHtml ? firstImage(fullHtml, url) : null) ??
      (descHtml ? firstImage(descHtml, url) : null);
    const body =
      content ??
      (descHtml && htmlToText(descHtml).length > 400 ? sanitizeHtml(descHtml, url) : null);

    return {
      id: `rss:${feed.id}:${text(child(item, "guid", "id")) || url}`,
      title: htmlToText(text(child(item, "title"))) || "(untitled)",
      url,
      image,
      summary: summarize(descHtml || fullHtml),
      type: "rss",
      publishedAt: iso,
      createdAt: iso,
      commentsPermalink: comments || url,
      // The name from the feed list wins, so rows match the source chips.
      source: { id: feed.id, name: feed.title || title, handle: "", image: sourceImage },
      tags: categories,
      readTime: readTime(fullHtml || null),
      numUpvotes: 0,
      numComments: 0,
      author: author ? { name: htmlToText(author), image: null } : null,
      rss: {
        // The reader shows the cover above the article, so don't repeat it.
        content: body && image ? dropLeadingImage(body) : body,
        commentsUrl: comments && comments !== url ? comments : null,
      },
    };
  });

  return { title, siteUrl, posts };
};

type Permissions = {
  request: (p: { origins: string[] }) => Promise<boolean>;
  contains: (p: { origins: string[] }) => Promise<boolean>;
};

const permissions = () =>
  (globalThis as unknown as { chrome?: { permissions?: Permissions } }).chrome?.permissions;

const originPattern = (url: string) => `${new URL(url).origin}/*`;

/**
 * Asks for access to a custom feed's site. Must run directly in a click
 * handler, before any await, or the browser refuses to show the prompt.
 */
export const requestFeedPermission = (url: string): Promise<boolean> => {
  const perms = permissions();
  if (!perms?.request) return Promise.resolve(true);
  return perms.request({ origins: [originPattern(url)] });
};

/**
 * Feed sites the extension can't read yet. Chrome can withhold host access
 * (site access set to "on click", or a manifest change that needs the
 * extension reloaded), and a fetch then fails as a CORS error.
 */
export const missingFeedAccess = async (urls: string[]): Promise<string[]> => {
  const perms = permissions();
  if (!perms?.contains) return [];
  const origins = [...new Set(urls.map(originPattern))];
  const granted = await Promise.all(origins.map((o) => perms.contains({ origins: [o] })));
  return origins.filter((_, i) => !granted[i]);
};

/** Must run directly in a click handler. Throws if the manifest doesn't allow these origins. */
export const requestFeedAccess = (origins: string[]) =>
  permissions()?.request({ origins }) ?? Promise.resolve(true);
