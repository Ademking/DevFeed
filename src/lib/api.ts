import { readStore } from "@/lib/storage";

// daily.dev is talked to through its GraphQL API using the session cookies the
// browser already holds for daily.dev. Having host permission for
// api.daily.dev makes those requests same-site, so the cookies (even
// SameSite=Strict ones) are sent. That means no API key to paste: just be
// signed in to daily.dev in this browser.
//
// In dev the page runs on localhost, where the browser won't attach daily.dev
// cookies, so requests go through the Vite proxy, which forwards a cookie you
// paste once (see `devCookie` below).
const GRAPHQL_URL = import.meta.env.DEV
  ? "/daily-graphql"
  : "https://api.daily.dev/graphql";

export const DAILY_URL = "https://daily.dev";

/** Dev-only: a raw Cookie header for localhost, since the page can't use the
 * browser's daily.dev cookies. Ignored in the built extension. */
const devCookie = () => (import.meta.env.DEV ? readStore("devCookie", "") : "");

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

// daily.dev reports failures as GraphQL errors with a code in `extensions`.
const CODE_STATUS: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PAYMENT_REQUIRED: 402,
  RATE_LIMITED: 429,
  CONFLICT: 409,
};

interface GqlError {
  message: string;
  extensions?: { code?: string };
}

interface GqlResponse<T> {
  data?: T | null;
  errors?: GqlError[];
}

const gql = async <T>(query: string, variables: Record<string, unknown> = {}): Promise<T> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const cookie = devCookie();
  if (cookie) headers["X-Daily-Cookie"] = cookie;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  let body: GqlResponse<T>;
  try {
    body = (await res.json()) as GqlResponse<T>;
  } catch {
    throw new ApiError(res.status || 500, res.statusText || "daily.dev returned an invalid response.");
  }

  if (body.errors?.length) {
    const first = body.errors[0];
    const code = first.extensions?.code ?? "";
    const status = CODE_STATUS[code] ?? (res.ok ? 400 : res.status);
    const retryAfter = Number(res.headers.get("retry-after")) || undefined;
    if (status === 401) {
      throw new ApiError(401, "You're not signed in to daily.dev.", retryAfter);
    }
    if (code === "RATE_LIMITED") {
      throw new ApiError(429, "daily.dev is rate limiting DevFeed. Try again later.", retryAfter);
    }
    throw new ApiError(status, first.message || "daily.dev returned an error.", retryAfter);
  }

  if (body.data === null || body.data === undefined) {
    throw new ApiError(res.status || 500, "daily.dev returned no data.");
  }
  return body.data;
};

// ---------- GraphQL documents ----------

// daily.dev picks the ranking pipeline with this number (its own default is
// 15). Leave it out and the API answers from a snapshot frozen years ago, so
// the feed fills up with 2024 posts.
const FEED_VERSION = 15;

const POST_INFO_FRAGMENT = `
fragment FeedPostInfo on Post {
  id
  title
  image
  permalink
  commentsPermalink
  createdAt
  summary
  type
  tags
  readTime
  numUpvotes
  numComments
  bookmarked
  source { id handle name image permalink }
  author { name image username permalink }
}`;

const FEED_FRAGMENT = `${POST_INFO_FRAGMENT}
fragment FeedConnection on PostConnection {
  pageInfo { hasNextPage endCursor }
  edges { node { ...FeedPostInfo } }
}`;

// "For you" is the personalised feed. For signed-in readers daily.dev serves it
// through feedV2; the old `feed` field answers from the same stale snapshot as
// above. Its edges are a union, and only FeedPostItem carries a post.
const FOR_YOU_QUERY = `query FeedV2($first: Int, $after: String, $version: Int) {
  page: feedV2(first: $first, after: $after, version: $version) {
    pageInfo { hasNextPage endCursor }
    edges { node {
      __typename
      ... on FeedPostItem { post { ...FeedPostInfo } }
    } }
  }
}
${POST_INFO_FRAGMENT}`;

const MOST_UPVOTED_QUERY = `query MostUpvotedFeed($first: Int, $after: String, $period: Int) {
  page: mostUpvotedFeed(first: $first, after: $after, period: $period) { ...FeedConnection }
}
${FEED_FRAGMENT}`;

const MOST_DISCUSSED_QUERY = `query MostDiscussedFeed($first: Int, $after: String, $period: Int) {
  page: mostDiscussedFeed(first: $first, after: $after, period: $period) { ...FeedConnection }
}
${FEED_FRAGMENT}`;

// Without a ranking the tag feed also falls back to the stale snapshot; TIME
// keeps it current.
const TAG_FEED_QUERY = `query TagFeed($tag: String!, $first: Int, $after: String) {
  page: tagFeed(tag: $tag, first: $first, after: $after, ranking: TIME) { ...FeedConnection }
}
${FEED_FRAGMENT}`;

const BOOKMARKS_QUERY = `query BookmarksFeed($first: Int, $after: String) {
  page: bookmarksFeed(first: $first, after: $after) { ...FeedConnection }
}
${FEED_FRAGMENT}`;

const SEARCH_QUERY = `query SearchPosts($query: String!, $first: Int, $after: String) {
  page: searchPosts(query: $query, first: $first, after: $after) { ...FeedConnection }
}
${FEED_FRAGMENT}`;

const VIEWER_QUERY = `query Viewer { whoami { id } }`;

const PROFILE_QUERY = `query Viewer {
  whoami { id name image username permalink reputation isPlus }
  userStreak { current max total }
}`;

const ADD_BOOKMARK = `mutation AddBookmark($postId: ID!) {
  addBookmarks(data: { postIds: [$postId] }) { postId }
}`;

const REMOVE_BOOKMARK = `mutation RemoveBookmark($id: ID!) {
  removeBookmark(id: $id) { _ }
}`;

const COMMENTS_QUERY = `query PostComments($postId: ID!, $first: Int, $after: String) {
  postComments(postId: $postId, first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    edges { node { ...CommentNode } }
  }
}
fragment CommentNode on Comment {
  id
  contentHtml
  createdAt
  permalink
  numUpvotes
  author { id name username image permalink }
  children {
    edges { node {
      id
      contentHtml
      createdAt
      permalink
      numUpvotes
      author { id name username image permalink }
    } }
  }
}`;

// ---------- Mapping ----------

interface GqlPost {
  id: string;
  title: string;
  image: string | null;
  permalink: string;
  commentsPermalink: string;
  createdAt: string;
  summary: string | null;
  type: string | null;
  tags: string[] | null;
  readTime: number | null;
  numUpvotes: number | null;
  numComments: number | null;
  source: Source | null;
  author: { name: string | null; image: string | null } | null;
}

interface GqlConnection<T> {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  edges: { node: T }[];
}

interface FeedData {
  page: GqlConnection<GqlPost>;
}

/** feedV2 mixes post items with highlight cards; only post items carry a post. */
interface FeedV2Node {
  __typename: string;
  post?: GqlPost | null;
}

interface FeedV2Data {
  page: GqlConnection<FeedV2Node>;
}

const mapPost = (node: GqlPost): Post => ({
  id: node.id,
  title: node.title,
  url: node.permalink,
  image: node.image ?? null,
  summary: node.summary ?? null,
  type: node.type ?? "article",
  publishedAt: node.createdAt ?? null,
  createdAt: node.createdAt,
  commentsPermalink: node.commentsPermalink,
  source: {
    id: node.source?.id ?? "",
    name: node.source?.name ?? "",
    handle: node.source?.handle ?? "",
    image: node.source?.image ?? null,
  },
  tags: node.tags ?? [],
  readTime: node.readTime ?? null,
  numUpvotes: node.numUpvotes ?? 0,
  numComments: node.numComments ?? 0,
  author: node.author
    ? { name: node.author.name ?? "", image: node.author.image ?? null }
    : null,
});

const mapPageInfo = (
  info?: { hasNextPage: boolean; endCursor: string | null }
): Page<Post>["pagination"] =>
  info ? { hasNextPage: !!info.hasNextPage, cursor: info.endCursor ?? null } : undefined;

const mapFeed = (data: FeedData): Page<Post> => ({
  data: (data.page?.edges ?? []).map((edge) => mapPost(edge.node)),
  pagination: mapPageInfo(data.page?.pageInfo),
});

const mapFeedV2 = (data: FeedV2Data): Page<Post> => ({
  data: (data.page?.edges ?? [])
    .map((edge) => edge.node.post)
    .filter((post): post is GqlPost => !!post)
    .map(mapPost),
  pagination: mapPageInfo(data.page?.pageInfo),
});

// ---------- Feeds ----------

export type FeedKey =
  | { kind: "foryou" }
  | { kind: "popular" }
  | { kind: "discussed"; period: 7 | 30 | 365 }
  | { kind: "bookmarks" }
  | { kind: "tag"; tag: string }
  | { kind: "search"; q: string }
  | { kind: "rss" };

export const feedKeyId = (key: FeedKey) => JSON.stringify(key);

/** Cheap check that the browser's daily.dev session is usable. Returns false
 * only when daily.dev explicitly reports the session as unauthenticated. */
export const checkConnection = async (): Promise<boolean> => {
  try {
    await gql(VIEWER_QUERY);
    return true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return false;
    throw e;
  }
};

export const fetchFeed = async (
  key: FeedKey,
  cursor?: string | null,
  limit = 30
): Promise<Page<Post>> => {
  const vars = { first: limit, after: cursor ?? null };
  switch (key.kind) {
    case "foryou":
      return mapFeedV2(await gql<FeedV2Data>(FOR_YOU_QUERY, { ...vars, version: FEED_VERSION }));
    case "popular":
      return mapFeed(await gql<FeedData>(MOST_UPVOTED_QUERY, vars));
    case "discussed":
      return mapFeed(await gql<FeedData>(MOST_DISCUSSED_QUERY, { ...vars, period: key.period }));
    case "bookmarks":
      return mapFeed(await gql<FeedData>(BOOKMARKS_QUERY, vars));
    case "tag":
      return mapFeed(await gql<FeedData>(TAG_FEED_QUERY, { ...vars, tag: key.tag }));
    case "search":
      return mapFeed(await gql<FeedData>(SEARCH_QUERY, { ...vars, query: key.q }));
    case "rss":
      throw new Error("RSS feeds are not loaded from daily.dev");
  }
};

export const fetchProfile = async (): Promise<Profile> => {
  const data = await gql<{
    whoami: {
      id: string;
      name: string | null;
      image: string | null;
      username: string | null;
      permalink: string;
      reputation: number | null;
      isPlus: boolean | null;
    };
    userStreak: { current: number; max: number; total: number } | null;
  }>(PROFILE_QUERY);
  const u = data.whoami;
  return {
    id: u.id,
    name: u.name ?? null,
    username: u.username ?? null,
    image: u.image ?? null,
    permalink: u.permalink,
    reputation: u.reputation ?? 0,
    isPlus: u.isPlus ?? null,
    streak: data.userStreak
      ? {
          current: data.userStreak.current,
          max: data.userStreak.max,
          total: data.userStreak.total,
        }
      : null,
  };
};

export const addBookmark = (postId: string) => gql(ADD_BOOKMARK, { postId });

export const removeBookmark = (postId: string) => gql(REMOVE_BOOKMARK, { id: postId });

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

interface GqlComment {
  id: string;
  contentHtml: string;
  createdAt: string;
  permalink: string;
  numUpvotes: number;
  author: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
    permalink: string;
  } | null;
  children?: { edges: { node: GqlComment }[] };
}

/** Comments arrive as HTML; the reader shows them as plain text. */
const commentText = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const br of doc.querySelectorAll("br")) br.replaceWith("\n");
  for (const el of doc.querySelectorAll("p, li, div, blockquote, h1, h2, h3, h4, h5, h6"))
    el.append("\n");
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
};

const mapComment = (node: GqlComment): Comment => ({
  id: node.id,
  content: commentText(node.contentHtml ?? ""),
  createdAt: node.createdAt,
  permalink: node.permalink,
  numUpvotes: node.numUpvotes ?? 0,
  author: {
    id: node.author?.id ?? "",
    name: node.author?.name ?? "[deleted]",
    username: node.author?.username ?? null,
    image: node.author?.image ?? null,
    permalink: node.author?.permalink ?? "",
  },
  children: node.children?.edges.map((edge) => mapComment(edge.node)),
});

export const fetchComments = async (
  postId: string,
  cursor?: string | null
): Promise<Page<Comment>> => {
  const data = await gql<{ postComments: GqlConnection<GqlComment> }>(COMMENTS_QUERY, {
    postId,
    first: 30,
    after: cursor ?? null,
  });
  return {
    data: (data.postComments?.edges ?? []).map((edge) => mapComment(edge.node)),
    pagination: data.postComments?.pageInfo
      ? {
          hasNextPage: !!data.postComments.pageInfo.hasNextPage,
          cursor: data.postComments.pageInfo.endCursor ?? null,
        }
      : undefined,
  };
};
