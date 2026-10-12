import { writeStore } from "@/lib/storage";

// In dev the page runs on localhost, which the API does not allow via CORS,
// so requests go through the Vite proxy. The extension calls the API directly.
const BASE_URL = import.meta.env.DEV
  ? "/daily-api"
  : "https://api.daily.dev/public/v1";

export interface Source {
  id: string;
  name: string;
  handle: string;
  image: string | null;
}

export interface Post {
  id: string;
  title: string;
  url: string;
  image: string | null;
  summary: string | null;
  type: string;
  publishedAt: string | null;
  createdAt: string;
  commentsPermalink: string;
  source: Source;
  tags: string[];
  readTime: number | null;
  numUpvotes: number;
  numComments: number;
  author: { name: string; image: string | null } | null;
  bookmarkedAt?: string;
  /** Set on posts that come from an RSS feed rather than daily.dev. */
  rss?: {
    /** Sanitized article HTML, when the feed includes it. */
    content: string | null;
    /** A separate discussion page (Hacker News). */
    commentsUrl: string | null;
  };
}

export interface Page<T> {
  data: T[];
  pagination?: { hasNextPage: boolean; cursor: string | null };
}

export interface Profile {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  permalink: string;
  reputation: number;
  isPlus: boolean | null;
  streak: { current: number; max: number; total: number } | null;
}

export class ApiError extends Error {
  status: number;
  retryAfter?: number;

  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const request = async <T>(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const remaining = res.headers.get("x-ratelimit-remaining");
  if (remaining !== null) {
    writeStore("ratelimit", {
      remaining: Number(remaining),
      limit: Number(res.headers.get("x-ratelimit-limit")),
      at: Date.now(),
    });
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message || body.error || message;
    } catch {
      // body is not JSON
    }
    if (res.status === 401) message = "Your token is missing or invalid.";
    if (res.status === 403)
      message = "This endpoint needs daily.dev Plus or a token with more scope.";
    const retryAfter = Number(res.headers.get("retry-after")) || undefined;
    throw new ApiError(res.status, message, retryAfter);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
};

export type FeedKey =
  | { kind: "foryou" }
  | { kind: "popular" }
  | { kind: "discussed"; period: 7 | 30 | 365 }
  | { kind: "bookmarks" }
  | { kind: "tag"; tag: string }
  | { kind: "search"; q: string }
  | { kind: "rss" };

export const feedKeyId = (key: FeedKey) => JSON.stringify(key);

const qs = (params: Record<string, string | number | undefined | null>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const fetchFeed = (
  token: string,
  key: FeedKey,
  cursor?: string | null,
  limit = 30
): Promise<Page<Post>> => {
  const base = { limit, cursor };
  switch (key.kind) {
    case "foryou":
      return request(token, `/feeds/foryou${qs(base)}`);
    case "popular":
      return request(token, `/feeds/popular${qs(base)}`);
    case "discussed":
      return request(token, `/feeds/discussed${qs({ ...base, period: key.period })}`);
    case "bookmarks":
      return request(token, `/bookmarks/${qs(base)}`);
    case "tag":
      return request(token, `/feeds/tag/${encodeURIComponent(key.tag)}${qs(base)}`);
    case "search":
      return request(token, `/search/posts${qs({ ...base, q: key.q })}`);
    case "rss":
      throw new Error("RSS feeds are not loaded from daily.dev");
  }
};

export const fetchProfile = (token: string) =>
  request<Profile>(token, "/profile/");

export const addBookmark = (token: string, postId: string) =>
  request(token, "/bookmarks/", {
    method: "POST",
    body: JSON.stringify({ postIds: [postId] }),
  });

export const removeBookmark = (token: string, postId: string) =>
  request(token, `/bookmarks/${encodeURIComponent(postId)}`, {
    method: "DELETE",
  });

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  permalink: string;
  numUpvotes: number;
  author: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
    permalink: string;
  };
  children?: Comment[];
}

export const fetchComments = (token: string, postId: string, cursor?: string | null) =>
  request<Page<Comment>>(
    token,
    `/posts/${encodeURIComponent(postId)}/comments${qs({ limit: 30, cursor, sort: "oldest" })}`
  );
