import { GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { SourceAvatar } from "@/components/post-item";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { faviconUrl } from "@/lib/favicon";
import { hostname } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  BUILTIN_FEEDS,
  moveFeed,
  fetchFeedXml,
  parseFeed,
  type RssFeed,
  requestFeedPermission,
} from "@/lib/rss";

const normalizeFeedUrl = (raw: string) => {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

interface RssFeedsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feeds: RssFeed[];
  onChange: (feeds: RssFeed[]) => void;
}

export const RssFeedsDialog = ({ open, onOpenChange, feeds, onChange }: RssFeedsDialogProps) => {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragUrl, setDragUrl] = useState<string | null>(null);
  const [overUrl, setOverUrl] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeFeedUrl(url);
    if (!normalized) {
      setError("Enter a feed address, like example.com/feed.xml");
      return;
    }
    if (feeds.some((f) => f.url === normalized)) {
      setError("That feed is already in your list.");
      return;
    }
    // The permission prompt has to open before any other await.
    const granted = await requestFeedPermission(normalized);
    if (!granted) {
      setError(`DevFeed needs access to ${hostname(normalized)} to read this feed.`);
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const parsed = parseFeed(await fetchFeedXml(normalized), {
        id: normalized,
        url: normalized,
        title: "",
      });
      onChange([...feeds, { id: normalized, url: normalized, title: parsed.title, enabled: true }]);
      setUrl("");
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("RSS")
          ? "That address isn't an RSS or Atom feed. Look for a link named RSS or feed on the site."
          : `Couldn't load that feed (${err instanceof Error ? err.message : "unknown error"}).`
      );
    } finally {
      setAdding(false);
    }
  };

  const toggle = (feed: RssFeed, enabled: boolean) =>
    onChange(feeds.map((f) => (f.url === feed.url ? { ...f, enabled } : f)));

  const remove = (feed: RssFeed) => onChange(feeds.filter((f) => f.url !== feed.url));

  const enabledCount = feeds.filter((f) => f.enabled).length;

  return (
    <Dialog onOpenChange={(d) => onOpenChange(d.open)} open={open}>
      <DialogContent size="lg">
        <DialogHeader
          description={`${enabledCount} of ${feeds.length} feeds on. Feeds refresh every 30 minutes and don't use daily.dev API requests.`}
          title="RSS feeds"
        />
        <DialogBody className="flex flex-col gap-5">
          <form className="flex flex-col gap-1.5" onSubmit={add}>
            <label className="font-medium text-sm" htmlFor="bdd-rss-url">
              Add a feed
            </label>
            <div className="flex gap-2">
              <Input
                aria-invalid={!!error || undefined}
                id="bdd-rss-url"
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                placeholder="https://example.com/feed.xml"
                spellCheck={false}
                value={url}
              />
              <Button disabled={!url.trim()} isLoading={adding} type="submit">
                <Plus />
                Add
              </Button>
            </div>
            {error && <p className="text-destructive-foreground text-xs">{error}</p>}
          </form>

          <ul className="flex flex-col divide-y border-y">
            {feeds.map((feed) => (
              <li
                className={cn(
                  "flex items-center gap-3 py-2.5",
                  dragUrl === feed.url && "opacity-40",
                  overUrl === feed.url && dragUrl !== feed.url && "bg-accent"
                )}
                // The whole row is the drop target; the grip starts the drag.
                draggable={dragUrl === feed.url}
                key={feed.url}
                onDragEnd={() => {
                  setDragUrl(null);
                  setOverUrl(null);
                }}
                onDragOver={(e) => {
                  if (!dragUrl) return;
                  e.preventDefault();
                  setOverUrl(feed.url);
                }}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  // Firefox only starts a drag when some data is set.
                  e.dataTransfer.setData("text/plain", feed.title);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragUrl) onChange(moveFeed(feeds, dragUrl, feed.url));
                  setDragUrl(null);
                  setOverUrl(null);
                }}
              >
                <span
                  aria-label={`Drag to reorder ${feed.title}`}
                  className="-me-1 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                  onPointerDown={() => setDragUrl(feed.url)}
                  onPointerUp={() => setDragUrl(null)}
                  title="Drag to reorder"
                >
                  <GripVertical className="size-4" />
                </span>
                <SourceAvatar
                  className="size-5"
                  source={{ name: feed.title || hostname(feed.url), image: faviconUrl(feed.url) }}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-sm">{feed.title}</span>
                  <span className="truncate text-muted-foreground text-xs">{feed.url}</span>
                </div>
                {!feed.builtIn && (
                  <Button
                    aria-label={`Remove ${feed.title}`}
                    onClick={() => remove(feed)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <Trash2 />
                  </Button>
                )}
                <Switch
                  aria-label={`Show ${feed.title}`}
                  checked={feed.enabled}
                  onCheckedChange={(d) => toggle(feed, d.checked)}
                />
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter className="sm:justify-start">
          <Button
            onClick={() =>
              onChange([...BUILTIN_FEEDS, ...feeds.filter((f) => !f.builtIn)])
            }
            size="sm"
            variant="ghost"
          >
            <RotateCcw />
            Reset built-in feeds
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
