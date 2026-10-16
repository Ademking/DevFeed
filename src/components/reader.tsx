import {
  AArrowDown,
  AArrowUp,
  ArrowBigUp,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Link2,
  MessageSquare,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PostStats, SourceAvatar } from "@/components/post-item";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useComments } from "@/hooks/use-comments";
import type { Comment, Post } from "@/lib/api";
import { compact, hostname, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const ToolButton = ({
  label,
  shortcut,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string; shortcut?: string }) => (
  <Tooltip positioning={{ placement: "bottom" }}>
    <TooltipTrigger asChild>
      <Button aria-label={label} size="icon-md" variant="ghost" {...props}>
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent className="flex items-center gap-2">
      {label}
      {shortcut && <span className="font-mono opacity-60">{shortcut}</span>}
    </TooltipContent>
  </Tooltip>
);

const CommentItem = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => (
  <li className="flex flex-col gap-3">
    <div className="flex gap-3">
      <Avatar className="mt-0.5" size="sm">
        {comment.author.image && <AvatarImage alt="" src={comment.author.image} />}
        <AvatarFallback>{comment.author.name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <a
            className="font-semibold text-foreground text-sm hover:underline"
            href={comment.author.permalink}
            rel="noopener noreferrer"
            target="_blank"
          >
            {comment.author.name}
          </a>
          {comment.author.username && (
            <span className="text-muted-foreground">@{comment.author.username}</span>
          )}
          <a
            className="text-muted-foreground hover:underline"
            href={comment.permalink}
            rel="noopener noreferrer"
            target="_blank"
          >
            {timeAgo(comment.createdAt)}
          </a>
        </div>
        <p
          className="whitespace-pre-line break-words font-reading text-foreground/90 leading-relaxed"
          dir="auto"
          style={COMMENT_SIZE}
        >
          {comment.content}
        </p>
        {comment.numUpvotes > 0 && (
          <span className="flex items-center gap-0.5 text-muted-foreground text-xs tabular-nums">
            <ArrowBigUp className="size-3.5" />
            {compact(comment.numUpvotes)}
          </span>
        )}
      </div>
    </div>
    {!!comment.children?.length && (
      <ul
        className={cn(
          "ms-3 flex flex-col gap-4 border-s ps-6",
          depth > 2 && "ms-0 ps-3"
        )}
      >
        {comment.children.map((c) => (
          <CommentItem comment={c} depth={depth + 1} key={c.id} />
        ))}
      </ul>
    )}
  </li>
);

const Comments = ({
  post,
  loadSignal,
}: {
  post: Post;
  loadSignal: number;
}) => {
  const { thread, loading, error, load } = useComments(post.id);
  const firstSignal = useRef(loadSignal);

  // "c" in the parent asks for comments without owning this hook.
  useEffect(() => {
    if (loadSignal !== firstSignal.current && !thread && post.numComments > 0) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSignal]);

  return (
    <section className="flex flex-col gap-5 border-t pt-8" id="comments">
      <h2 className="flex items-center gap-2 font-semibold text-base">
        Comments
        <span className="font-normal text-muted-foreground tabular-nums">
          {post.numComments}
        </span>
      </h2>

      {post.numComments === 0 ? (
        <p className="text-muted-foreground text-sm">
          No comments yet.{" "}
          <a
            className="font-medium text-foreground underline underline-offset-4"
            href={post.commentsPermalink}
            rel="noopener noreferrer"
            target="_blank"
          >
            Start the discussion on daily.dev
          </a>
        </p>
      ) : !thread ? (
        <div className="flex flex-col items-start gap-2">
          <Button isLoading={loading} onClick={load} variant="outline">
            <MessageSquare />
            Load {post.numComments} {post.numComments === 1 ? "comment" : "comments"}
            <Kbd className="ms-1">C</Kbd>
          </Button>
          <p className="text-muted-foreground text-xs">Uses 1 API request.</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-5">
            {thread.comments.map((c) => (
              <CommentItem comment={c} key={c.id} />
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            {thread.hasNext && (
              <Button isLoading={loading} onClick={load} size="sm" variant="outline">
                More comments
              </Button>
            )}
            <a
              className="text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
              href={post.commentsPermalink}
              rel="noopener noreferrer"
              target="_blank"
            >
              Reply on daily.dev
            </a>
          </div>
        </>
      )}
      {error && <p className="text-destructive-foreground text-sm">{error.message}</p>}
    </section>
  );
};

export interface ReaderProps {
  post: Post;
  position: { index: number; total: number };
  isBookmarked: boolean;
  target: "_blank" | "_self";
  commentsSignal: number;
  onPrev: () => void;
  onNext: () => void;
  onBookmark: (post: Post) => void;
  onOpen: (post: Post) => void;
  onTag: (tag: string) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  /** Leaves room for the sheet's close button. */
  inSheet?: boolean;
}

export const ZOOM = { min: 0.5, max: 2, step: 0.1 };

// Sizes come from CSS variables set in Settings, times the reader zoom.
const TITLE_SIZE = { fontSize: "calc(var(--article-title-size) * var(--reader-zoom))" };
const READING_SIZE = { fontSize: "calc(var(--reading-size) * var(--reader-zoom))" };
const COMMENT_SIZE = { fontSize: "calc(var(--reading-size) * 0.85 * var(--reader-zoom))" };

export const Reader = ({
  post,
  position,
  isBookmarked,
  target,
  commentsSignal,
  onPrev,
  onNext,
  onBookmark,
  onOpen,
  onTag,
  zoom,
  onZoom,
  inSheet,
}: ReaderProps) => {
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const host = hostname(post.url);
  const isRss = !!post.rss;
  const discussionUrl = isRss ? post.rss?.commentsUrl : post.commentsPermalink;
  const date = post.publishedAt ?? post.createdAt;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [post.id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-1 border-b px-3",
          inSheet && "pe-12"
        )}
      >
        <ToolButton
          disabled={position.index <= 0}
          label="Previous"
          onClick={onPrev}
          shortcut="K"
        >
          <ChevronUp />
        </ToolButton>
        <ToolButton
          disabled={position.index >= position.total - 1}
          label="Next"
          onClick={onNext}
          shortcut="J"
        >
          <ChevronDown />
        </ToolButton>
        <span className="ms-1 text-muted-foreground text-xs tabular-nums">
          {position.index + 1} of {position.total}
        </span>

        <div className="ms-auto flex items-center gap-1">
          <ToolButton
            disabled={zoom <= ZOOM.min + 0.001}
            label="Smaller text"
            onClick={() => onZoom(zoom - ZOOM.step)}
            shortcut="-"
          >
            <AArrowDown />
          </ToolButton>
          <Tooltip positioning={{ placement: "bottom" }}>
            <TooltipTrigger asChild>
              <button
                className="w-11 text-center text-muted-foreground text-xs tabular-nums hover:text-foreground"
                onClick={() => onZoom(1)}
                type="button"
              >
                {Math.round(zoom * 100)}%
              </button>
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2">
              Reset text size
              <span className="font-mono opacity-60">0</span>
            </TooltipContent>
          </Tooltip>
          <ToolButton
            disabled={zoom >= ZOOM.max - 0.001}
            label="Larger text"
            onClick={() => onZoom(zoom + ZOOM.step)}
            shortcut="+"
          >
            <AArrowUp />
          </ToolButton>
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          {!isRss && (
            <ToolButton
              className={cn(isBookmarked && "text-foreground")}
              label={isBookmarked ? "Remove bookmark" : "Bookmark"}
              onClick={() => onBookmark(post)}
              shortcut="B"
            >
              {isBookmarked ? <BookmarkCheck /> : <Bookmark />}
            </ToolButton>
          )}
          <ToolButton
            label={copied ? "Copied" : "Copy link"}
            onClick={() => {
              navigator.clipboard.writeText(post.url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            <Link2 />
          </ToolButton>
          {discussionUrl && (
            <ToolButton asChild label={`Discussion on ${hostname(discussionUrl)}`}>
              <a href={discussionUrl} rel="noopener noreferrer" target={target}>
                <MessageSquare />
              </a>
            </ToolButton>
          )}
          <Button asChild className="ms-1" size="md">
            <a
              href={post.url}
              onClick={() => onOpen(post)}
              rel="noopener noreferrer"
              target={target}
            >
              Open article
              <ArrowUpRight />
            </a>
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" ref={scrollRef}>
        {post.image && (
          <img
            alt=""
            className="block aspect-[21/9] max-h-[440px] w-full border-b object-cover"
            src={post.image}
          />
        )}
        <article className="flex w-full flex-col gap-7 px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
          <header className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
              <SourceAvatar className="size-5" source={post.source} />
              <span className="font-medium text-foreground">{post.source.name}</span>
              {post.author?.name && post.author.name !== post.source.name && (
                <span>by {post.author.name}</span>
              )}
              <span aria-hidden>·</span>
              <time dateTime={date} title={new Date(date).toLocaleString()}>
                {new Date(date).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              <span aria-hidden>·</span>
              <span>{host}</span>
            </div>
            <h1
              className="text-balance font-heading font-semibold leading-[1.08]"
              dir="auto"
              style={TITLE_SIZE}
            >
              <a
                className="hover:underline hover:decoration-2 hover:decoration-foreground/40 hover:underline-offset-4"
                href={post.url}
                onClick={() => onOpen(post)}
                rel="noopener noreferrer"
                target={target}
              >
                {post.title}
              </a>
            </h1>
            <PostStats className="text-sm [&_svg]:size-4" post={post} />
          </header>

          {post.rss?.content ? (
            <section
              className="rss-content font-reading text-foreground/90"
              dir="auto"
              // Sanitized in lib/sanitize.ts: allowlisted tags, http(s) links only, no attributes beyond href/src/alt.
              dangerouslySetInnerHTML={{ __html: post.rss.content }}
              style={READING_SIZE}
            />
          ) : (
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                {isRss ? "Summary" : "TL;DR"}
              </h2>
              {post.summary ? (
                <p className="font-reading text-foreground/90 leading-[1.65]" dir="auto" style={READING_SIZE}>
                  {post.summary}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {isRss
                    ? "This feed doesn't include a summary. Open the article to read it."
                    : "daily.dev has no summary for this post."}
                </p>
              )}
            </section>
          )}

          {!isRss && !!post.tags.length && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <button
                  className="bg-muted px-2 py-0.5 font-mono text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
                  key={tag}
                  onClick={() => onTag(tag)}
                  type="button"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          <a
            className="group flex items-center justify-between gap-4 border bg-card px-5 py-4 transition-colors hover:border-foreground/40"
            href={post.url}
            onClick={() => onOpen(post)}
            rel="noopener noreferrer"
            target={target}
          >
            <span className="flex flex-col">
              <span className="font-medium">Read the full article</span>
              <span className="text-muted-foreground text-sm">
                {host}
                {post.readTime ? ` · ${post.readTime} min read` : ""}
              </span>
            </span>
            <ArrowUpRight className="size-5 text-muted-foreground group-hover:text-foreground" />
          </a>

          {isRss ? (
            discussionUrl && (
              <a
                className="flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
                href={discussionUrl}
                rel="noopener noreferrer"
                target={target}
              >
                <MessageSquare className="size-4" />
                Read the discussion on {hostname(discussionUrl)}
              </a>
            )
          ) : (
          <Comments
            key={post.id}
            loadSignal={commentsSignal}
            post={post}
          />
          )}
        </article>
      </div>
    </div>
  );
};
