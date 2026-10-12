import { AlertTriangle, ExternalLink, Inbox, KeyRound, Rss } from "lucide-react";
import { useState } from "react";
import { TOKEN_URL } from "@/components/settings-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import type { Layout } from "@/lib/storage";
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
      ? "Out of API requests"
      : status === 401
        ? "daily.dev rejected your token"
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
            Update token
          </Button>
        )}
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </Centered>
  );
};

/**
 * Shown in place of the daily.dev feeds until a token is saved. The rest of
 * the app (RSS, favourites, welcome screen) works without one.
 */
export const ConnectPrompt = ({
  onSave,
  onOpenRss,
}: {
  onSave: (token: string) => void;
  onOpenRss: () => void;
}) => {
  const [token, setToken] = useState("");
  return (
    <div className="flex justify-center px-2 py-10">
      <div className="flex w-full max-w-md flex-col gap-5 border bg-card p-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4" />
            <h2 className="font-heading font-semibold text-base">Connect daily.dev</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            For you, Popular, Most discussed and Bookmarks load from your daily.dev account.
          </p>
        </div>
        <ol className="flex flex-col gap-2 text-sm">
          <li className="flex gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center bg-muted font-medium text-xs">
              1
            </span>
            <span>
              Go to{" "}
              <a
                className="inline-flex items-center gap-0.5 font-medium underline underline-offset-4"
                href={TOKEN_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                daily.dev Settings, API
                <ExternalLink className="size-3" />
              </a>{" "}
              and generate a token.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center bg-muted font-medium text-xs">
              2
            </span>
            <span>Paste it here. It stays in this browser and is sent only to api.daily.dev.</span>
          </li>
        </ol>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (token.trim()) onSave(token.trim());
          }}
        >
          <Input
            autoComplete="off"
            className="flex-1 font-mono"
            onChange={(e) => setToken(e.target.value)}
            placeholder="Personal access token"
            spellCheck={false}
            type="password"
            value={token}
          />
          <Button disabled={!token.trim()} type="submit">
            Connect
          </Button>
        </form>
        <div className="flex items-center justify-between gap-3 border-t pt-4 text-muted-foreground text-xs">
          <span>RSS feeds work without a token.</span>
          <Button onClick={onOpenRss} size="xs" variant="outline">
            <Rss />
            Read RSS feeds
          </Button>
        </div>
      </div>
    </div>
  );
};
