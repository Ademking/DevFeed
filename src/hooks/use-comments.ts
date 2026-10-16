import { useCallback, useEffect, useState } from "react";
import { type Comment, fetchComments } from "@/lib/api";
import { readStore, writeStore } from "@/lib/storage";

const MAX_CACHED_THREADS = 25;

interface Thread {
  comments: Comment[];
  cursor: string | null;
  hasNext: boolean;
}

type ThreadCache = Record<string, Thread & { at: number }>;

/** Comments load only on request, since each load costs one API call. */
export const useComments = (postId: string | null) => {
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setError(null);
    setLoading(false);
    setThread(postId ? (readStore<ThreadCache>("comments", {})[postId] ?? null) : null);
  }, [postId]);

  const load = useCallback(async () => {
    if (!postId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchComments(postId, thread?.cursor);
      const next: Thread = {
        comments: [...(thread?.comments ?? []), ...(page.data ?? [])],
        cursor: page.pagination?.cursor ?? null,
        hasNext: page.pagination?.hasNextPage ?? false,
      };
      setThread(next);
      const cache = readStore<ThreadCache>("comments", {});
      cache[postId] = { ...next, at: Date.now() };
      const trimmed = Object.fromEntries(
        Object.entries(cache)
          .sort(([, a], [, b]) => b.at - a.at)
          .slice(0, MAX_CACHED_THREADS)
      );
      writeStore("comments", trimmed);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [postId, thread, loading]);

  return { thread, loading, error, load };
};
