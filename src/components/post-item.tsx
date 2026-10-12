import { ArrowBigUp, BookmarkCheck, Clock, FileText, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Post } from "@/lib/api";
import { faviconUrl } from "@/lib/favicon";
import { compact, hostname, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface PostItemProps {
  post: Post;
  selected: boolean;
  isRead: boolean;
  isBookmarked: boolean;
  showSummary: boolean;
  showImage: boolean;
  onSelect: (post: Post) => void;
}

export const SourceAvatar = ({
  source,
  className,
}: {
  source: Pick<Post["source"], "name" | "image">;
  className?: string;
}) => (
  <Avatar className={cn("size-4.5 text-[9px]", className)}>
    {source.image && <AvatarImage alt="" src={source.image} />}
    <AvatarFallback>{source.name.slice(0, 1).toUpperCase()}</AvatarFallback>
  </Avatar>
);

export const PostStats = ({ post, className }: { post: Post; className?: string }) => (
  <div
    className={cn(
      "flex items-center gap-3 text-muted-foreground text-xs tabular-nums",
      className
    )}
  >
    {/* RSS items have no votes or comment counts. */}
    {!post.rss && (
      <>
        <span className="flex items-center gap-0.5" title="Upvotes">
          <ArrowBigUp className="size-3.5" />
          {compact(post.numUpvotes)}
        </span>
        <span className="flex items-center gap-1" title="Comments">
          <MessageSquare className="size-3" />
          {compact(post.numComments)}
        </span>
      </>
    )}
    {post.rss?.content && (
      <span className="flex items-center gap-1" title="Full article available here">
        <FileText className="size-3" />
        Full text
      </span>
    )}
    {!!post.readTime && (
      <span className="flex items-center gap-1" title="Read time">
        <Clock className="size-3" />
        {post.readTime} min
      </span>
    )}
  </div>
);

const SourceLine = ({ post, isRead }: { post: Post; isRead: boolean }) => (
  <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
    {/* Read posts drop the dot entirely so the source sits flush left. */}
    {!isRead && (
      <span aria-label="Unread" className="size-1.5 shrink-0 rounded-full bg-foreground" />
    )}
    <SourceAvatar source={post.source} />
    <span className="truncate font-medium text-foreground/80">{post.source.name}</span>
    <span className="shrink-0">· {timeAgo(post.publishedAt ?? post.createdAt)}</span>
  </div>
);

/** The whole item is one button; nothing inside it is separately clickable. */
const selectButtonClass =
  "text-start outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-foreground/40";

export const PostRow = ({
  post,
  selected,
  isRead,
  isBookmarked,
  showSummary,
  showImage,
  onSelect,
}: PostItemProps) => (
  <article
    className={cn(
      "group relative flex gap-3 rounded-lg px-3 py-3.5 transition-colors",
      selected ? "bg-accent" : "hover:bg-muted/60"
    )}
    data-post-id={post.id}
  >
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <SourceLine isRead={isRead} post={post} />
      <button
        className={cn(
          selectButtonClass,
          "line-clamp-3 font-heading font-semibold text-(length:--feed-title-size) leading-[1.18]",
          isRead && !selected ? "text-muted-foreground" : "text-foreground"
        )}
        onClick={() => onSelect(post)}
        type="button"
      >
        {post.title}
      </button>
      {showSummary && !!post.summary && (
        <p className="line-clamp-2 text-muted-foreground text-[13px] leading-relaxed">
          {post.summary}
        </p>
      )}
      <div className="flex items-center gap-3 pt-0.5">
        <PostStats post={post} />
        {isBookmarked && <BookmarkCheck className="size-3.5 text-foreground" />}
      </div>
    </div>
    {showImage && !!post.image && (
      <img
        alt=""
        className={cn(
          "size-16 shrink-0 self-center rounded-md border object-cover",
          isRead && !selected && "opacity-60"
        )}
        loading="lazy"
        src={post.image}
      />
    )}
  </article>
);

/** The post image, or the linked site's icon and domain when there is none (or it fails to load). */
const CardCover = ({ post, isRead }: { post: Post; isRead: boolean }) => {
  const [broken, setBroken] = useState(false);
  const [iconBroken, setIconBroken] = useState(false);
  const host = hostname(post.url);
  const icon = faviconUrl(post.url, 64);
  const showImage = post.image && !broken;
  return (
    <div className={cn("aspect-[16/9] overflow-hidden border-b", isRead && "opacity-60")}>
      {showImage ? (
        <img
          alt=""
          className="size-full object-cover"
          loading="lazy"
          onError={() => setBroken(true)}
          src={post.image ?? undefined}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 bg-[repeating-linear-gradient(135deg,transparent_0_10px,color-mix(in_srgb,var(--foreground)_4%,transparent)_10px_11px)] px-4">
          {icon && !iconBroken ? (
            <img alt="" className="size-10" onError={() => setIconBroken(true)} src={icon} />
          ) : (
            <span className="flex size-10 items-center justify-center border font-heading font-semibold text-lg uppercase">
              {(host || post.source.name).charAt(0)}
            </span>
          )}
          <span className="max-w-full truncate font-mono text-muted-foreground text-xs">
            {host}
          </span>
        </div>
      )}
    </div>
  );
};

export const PostCard = ({
  post,
  selected,
  isRead,
  isBookmarked,
  showSummary,
  showImage,
  onSelect,
}: PostItemProps) => (
  <article
    className={cn(
      "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors",
      selected
        ? "border-foreground"
        : "hover:border-foreground/40"
    )}
    data-post-id={post.id}
  >
    {showImage && <CardCover isRead={isRead} post={post} />}
    <div className="flex flex-1 flex-col gap-2.5 p-4">
      <SourceLine isRead={isRead} post={post} />
      <button
        className={cn(
          selectButtonClass,
          "line-clamp-3 font-heading font-semibold text-(length:--feed-title-size) leading-[1.18]",
          isRead ? "text-muted-foreground" : "text-foreground"
        )}
        onClick={() => onSelect(post)}
        type="button"
      >
        {post.title}
      </button>
      {showSummary && !!post.summary && (
        <p className="line-clamp-3 text-[13px] text-muted-foreground leading-relaxed">
          {post.summary}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between pt-1">
        <PostStats post={post} />
        {isBookmarked && <BookmarkCheck className="size-3.5 text-foreground" />}
      </div>
    </div>
  </article>
);
