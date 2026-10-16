import { AlertTriangle, ExternalLink, Inbox, KeyRound, Rss } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, DAILY_URL } from "@/lib/api";
import { type Layout, readStore, writeStore } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const FeedSkeleton = ({ layout }: { layout: Layout }) =>
  layout === "cards" ? (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
      {Array.from({ length: 12 }, (_, i) => (
        <div className="overflow-hidden rounded-xl border" key={i}>
          <Skeleton className="aspect-[16/9] rounded-none" />
          <div className="flex flex-col gap-2 p-3.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="flex flex-col">
      {Array.from({ length: 10 }, (_, i) => (
        <div className="flex gap-3 px-3 py-3" key={i}>
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className={cn("h-4", i % 2 ? "w-3/4" : "w-11/12")} />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="size-16 rounded-md" />
        </div>
      ))}
    </div>
  );

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">{children}</div>
);

export const EmptyState = ({ message }: { message: string }) => (
  <Centered>
    <Inbox className="size-8 text-muted-foreground/60" />
    <p className="text-muted-foreground text-sm">{message}</p>
  </Centered>
);

export const ErrorState = ({
  error,
  onRetry,
  onOpenSettings,
}: {
  error: Error;
  onRetry: () => void;
  onOpenSettings: () => void;
}) => {
  const status = error instanceof ApiError ? error.status : 0;
  const title =
    status === 429
      ? "daily.dev is rate limiting DevFeed"
      : status === 401
        ? "daily.dev isn't connected"
        : status
          ? `daily.dev returned an error (${status})`
          : "Couldn't reach daily.dev";
  return (
    <Centered>
      <AlertTriangle className="size-8 text-warning" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p className="max-w-sm text-muted-foreground text-sm">
          {status ? error.message : "Check your connection and try again."}
          {error instanceof ApiError && error.retryAfter
            ? ` Try again in ${Math.ceil(error.retryAfter / 60)} min.`
            : ""}
        </p>
      </div>
      <div className="flex gap-2">
        {status === 401 && (
          <Button onClick={onOpenSettings} variant="outline">
            Connection settings
          </Button>
        )}
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </Centered>
  );
};

/**
 * Shown in place of the daily.dev feeds until the browser has a daily.dev
 * session. DevFeed reads the cookies daily.dev already set, so there's nothing
 * to copy: just be signed in. The rest of the app (RSS, favourites, welcome
 * screen) works without it.
 */
export const ConnectPrompt = ({
  onRecheck,
  onOpenRss,
}: {
  onRecheck: () => void | Promise<void>;
  onOpenRss: () => void;
}) => {
  const [checking, setChecking] = useState(false);
  const [cookie, setCookie] = useState(() => readStore("devCookie", ""));

  const check = async () => {
    setChecking(true);
    await onRecheck();
    setChecking(false);
  };

  return (
    <div className="flex justify-center px-2 py-10">
      <div className="flex w-full max-w-md flex-col gap-5 border bg-card p-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4" />
            <h2 className="font-heading font-semibold text-base">Connect daily.dev</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            For you, Popular, Most discussed and Bookmarks load from your daily.dev
            account, using the daily.dev login this browser already has.
          </p>
        </div>
        <ol className="flex flex-col gap-2 text-sm">
          <li className="flex gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center bg-muted font-medium text-xs">
              1
            </span>
            <span>
              Make sure you're signed in to{" "}
              <a
                className="inline-flex items-center gap-0.5 font-medium underline underline-offset-4"
                href={DAILY_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                daily.dev
                <ExternalLink className="size-3" />
              </a>{" "}
              in this browser.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center bg-muted font-medium text-xs">
              2
            </span>
            <span>Come back and check again. No token to copy.</span>
          </li>
        </ol>
        <Button isLoading={checking} onClick={check}>
          Check again
        </Button>
        {import.meta.env.DEV && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <label className="font-medium text-xs" htmlFor="bdd-dev-cookie">
              Dev only: daily.dev cookie header
            </label>
            <div className="flex gap-2">
              <Input
                autoComplete="off"
                className="flex-1 font-mono text-xs"
                id="bdd-dev-cookie"
                onChange={(e) => setCookie(e.target.value)}
                placeholder="paste the Cookie header from daily.dev"
                spellCheck={false}
                value={cookie}
              />
              <Button
                onClick={() => {
                  writeStore("devCookie", cookie.trim());
                  check();
                }}
                variant="outline"
              >
                Save
              </Button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t pt-4 text-muted-foreground text-xs">
          <span>RSS feeds work without daily.dev.</span>
          <Button onClick={onOpenRss} size="xs" variant="outline">
            <Rss />
            Read RSS feeds
          </Button>
        </div>
      </div>
    </div>
  );
};
