import { useCallback, useEffect, useRef, useState } from "react";
import { type FeedKey, feedKeyId, fetchFeed, type Post } from "@/lib/api";
import { readStore, writeStore } from "@/lib/storage";

const PAGE_SIZE = 40;
const MAX_CACHED_POSTS = 200;

interface CachedFeed {
  posts: Post[];
  cursor: string | null;
  hasNext: boolean;
  fetchedAt: number;
}

export type FeedStatus = "idle" | "loading" | "refreshing" | "loading-more" | "error";

const cacheKey = (key: FeedKey) => `feed:${feedKeyId(key)}`;

// Search results are throwaway; don't let them pile up in storage.
const isCacheable = (key: FeedKey) => key.kind !== "search" && key.kind !== "rss";

export const useFeed = (
  enabled: boolean,
  key: FeedKey,
  refreshMinutes: number
) => {
  const id = feedKeyId(key);
  const [feed, setFeed] = useState<CachedFeed | null>(() =>
    isCacheable(key) ? readStore<CachedFeed | null>(cacheKey(key), null) : null
  );
  const [status, setStatus] = useState<FeedStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const requestId = useRef(0);

  const persist = useCallback(
    (next: CachedFeed) => {
      setFeed(next);
      if (isCacheable(key)) {
        writeStore(cacheKey(key), {
          ...next,
          posts: next.posts.slice(0, MAX_CACHED_POSTS),
        });
      }
    },
    // id captures key's identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id]
  );

  const load = useCallback(
    async (mode: "replace" | "more", current: CachedFeed | null) => {
      // RSS has its own loader (useRss); this hook sits idle for it.
      if (!enabled || key.kind === "rss") return;
      const rid = ++requestId.current;
      setStatus(
        mode === "more" ? "loading-more" : current ? "refreshing" : "loading"
      );
      setError(null);
      try {
        const page = await fetchFeed(
          key,
          mode === "more" ? current?.cursor : null,
          PAGE_SIZE
        );
        if (rid !== requestId.current) return;
        const incoming = page.data ?? [];
        let posts = incoming;
        if (mode === "more" && current) {
          const seen = new Set(current.posts.map((p) => p.id));
          posts = [...current.posts, ...incoming.filter((p) => !seen.has(p.id))];
        }
        persist({
          posts,
          cursor: page.pagination?.cursor ?? null,
          hasNext: page.pagination?.hasNextPage ?? false,
          fetchedAt: mode === "more" && current ? current.fetchedAt : Date.now(),
        });
        setStatus("idle");
      } catch (e) {
        if (rid !== requestId.current) return;
        setError(e as Error);
        setStatus("error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, id, persist]
  );

  // On feed switch: show cache instantly, refetch only when stale.
  useEffect(() => {
    const cached = isCacheable(key)
      ? readStore<CachedFeed | null>(cacheKey(key), null)
      : null;
    setFeed(cached);
    setError(null);
    setStatus("idle");
    requestId.current++;
    const stale =
      !cached ||
      (refreshMinutes > 0 &&
        Date.now() - cached.fetchedAt > refreshMinutes * 60_000);
    if (enabled && stale) load("replace", cached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, enabled]);

  const refresh = useCallback(() => load("replace", feed), [load, feed]);
  const loadMore = useCallback(() => {
    if (feed?.hasNext && status === "idle") load("more", feed);
  }, [load, feed, status]);

  const removePost = useCallback(
    (postId: string) => {
      if (feed) persist({ ...feed, posts: feed.posts.filter((p) => p.id !== postId) });
    },
    [feed, persist]
  );

  return {
    posts: feed?.posts ?? [],
    hasNext: feed?.hasNext ?? false,
    fetchedAt: feed?.fetchedAt ?? null,
    hasCache: feed !== null,
    status,
    error,
    refresh,
    loadMore,
    removePost,
  };
};
