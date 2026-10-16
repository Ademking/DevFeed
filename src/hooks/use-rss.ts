import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "@/lib/api";
import { idbGet, idbSet } from "@/lib/idb";
import {
  fetchFeedXml,
  missingFeedAccess,
  parseFeed,
  type RssFeed,
  requestFeedAccess,
} from "@/lib/rss";
import type { FeedStatus } from "@/hooks/use-feed";

// RSS never touches daily.dev, so feeds refresh more often than daily.dev ones.
const STALE_MS = 30 * 60_000;

interface CachedRss {
  posts: Post[];
  fetchedAt: number;
}

export type GrantResult = "granted" | "denied" | "reload";

const cacheKey = (feed: RssFeed) => `rss:${feed.url}`;

const loadFeed = async (feed: RssFeed): Promise<CachedRss> => {
  const { posts } = parseFeed(await fetchFeedXml(feed.url), feed);
  const entry = { posts, fetchedAt: Date.now() };
  idbSet(cacheKey(feed), entry);
  return entry;
};

/** Merged, newest-first timeline of the enabled feeds, with the same shape as useFeed. */
export const useRss = (active: boolean, feeds: RssFeed[]) => {
  const enabled = useMemo(() => feeds.filter((f) => f.enabled), [feeds]);
  const enabledKey = enabled.map((f) => f.url).join("|");
  const [byFeed, setByFeed] = useState<Record<string, CachedRss>>({});
  const [failed, setFailed] = useState<{ title: string; reason: string }[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [status, setStatus] = useState<FeedStatus>("idle");
  const run = useRef(0);

  const fetchAll = useCallback(async (targets: RssFeed[], hasData: boolean) => {
    if (!targets.length) return;
    const id = ++run.current;
    setStatus(hasData ? "refreshing" : "loading");
    const [results, noAccess] = await Promise.all([
      Promise.allSettled(targets.map(loadFeed)),
      missingFeedAccess(targets.map((f) => f.url)),
    ]);
    if (id !== run.current) return;
    const next: Record<string, CachedRss> = {};
    const errors: { title: string; reason: string }[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") next[targets[i].url] = r.value;
      else
        errors.push({
          title: targets[i].title,
          reason: r.reason instanceof Error ? r.reason.message : "failed",
        });
    });
    setByFeed((prev) => ({ ...prev, ...next }));
    setFailed(errors);
    setMissing(noAccess);
    setStatus(errors.length === targets.length ? "error" : "idle");
  }, []);

  // Show the cache instantly, then refetch feeds that are missing or stale.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the enabled URLs
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      const cached = await Promise.all(enabled.map((f) => idbGet<CachedRss>(cacheKey(f))));
      if (cancelled) return;
      const map: Record<string, CachedRss> = {};
      cached.forEach((c, i) => {
        if (c) map[enabled[i].url] = c;
      });
      setByFeed(map);
      const stale = enabled.filter(
        (f) => !map[f.url] || Date.now() - map[f.url].fetchedAt > STALE_MS
      );
      if (stale.length) fetchAll(stale, Object.keys(map).length > 0);
      else setMissing(await missingFeedAccess(enabled.map((f) => f.url)));
    })();
    return () => {
      cancelled = true;
    };
  }, [active, enabledKey, fetchAll]);

  const posts = useMemo(() => {
    const seen = new Set<string>();
    return enabled
      .flatMap((f) => byFeed[f.url]?.posts ?? [])
      .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  }, [enabled, byFeed]);

  const refresh = useCallback(
    () => fetchAll(enabled, posts.length > 0),
    [fetchAll, enabled, posts.length]
  );

  /** Call straight from a click handler: the permission prompt needs the user gesture. */
  const grantAccess = useCallback(async (): Promise<GrantResult> => {
    try {
      const ok = await requestFeedAccess(missing);
      if (ok) refresh();
      return ok ? "granted" : "denied";
    } catch {
      // Chrome refuses origins the running manifest doesn't list, which happens
      // when dist/ was rebuilt but the extension wasn't reloaded.
      return "reload";
    }
  }, [missing, refresh]);

  const fetchedTimes = enabled.map((f) => byFeed[f.url]?.fetchedAt).filter(Boolean) as number[];

  return {
    posts,
    hasNext: false,
    fetchedAt: fetchedTimes.length ? Math.min(...fetchedTimes) : null,
    hasCache: posts.length > 0,
    status,
    error: failed.length
      ? new Error(`Couldn't load ${failed.map((f) => `${f.title} (${f.reason})`).join(", ")}.`)
      : null,
    missingAccess: missing,
    grantAccess,
    refresh,
    loadMore: () => {},
    removePost: (_id: string) => {},
  };
};
