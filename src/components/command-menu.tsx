import { CornerDownLeft, Globe, Hash, Newspaper, Search, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SourceAvatar } from "@/components/post-item";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import type { Post } from "@/lib/api";
import { hostname } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

type ExtensionGlobals = {
  chrome?: { search?: { query: (o: { text: string; disposition?: string }) => void } };
  browser?: { search?: { search: (o: { query: string }) => Promise<void> } };
};

/** Searches with the browser's default engine when the extension can; Google otherwise. */
export const searchWeb = (text: string) => {
  const g = globalThis as unknown as ExtensionGlobals;
  if (g.chrome?.search?.query) g.chrome.search.query({ text, disposition: "CURRENT_TAB" });
  else if (g.browser?.search?.search) g.browser.search.search({ query: text });
  else window.location.href = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
};

const URL_LIKE = /^(https?:\/\/)?(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/\S*)?$/i;

const matches = (q: string, ...fields: (string | undefined)[]) =>
  fields.some((f) => f?.toLowerCase().includes(q));

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  favorites: { id: string; url: string; title: string }[];
  feeds: { value: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  tags: string[];
  posts: Post[];
  actions: CommandItem[];
  onFeed: (value: string) => void;
  onTag: (tag: string) => void;
  onSearchDaily: (q: string) => void;
  onPost: (post: Post) => void;
}

export const CommandMenu = ({
  open,
  onOpenChange,
  favorites,
  feeds,
  tags,
  posts,
  actions,
  onFeed,
  onTag,
  onSearchDaily,
  onPost,
}: CommandMenuProps) => {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const items = useMemo(() => {
    const raw = query.trim();
    const q = raw.toLowerCase();
    const out: CommandItem[] = [];
    if (raw) {
      if (URL_LIKE.test(raw)) {
        const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        out.push({
          id: "goto",
          group: "Go",
          label: raw,
          hint: "Open site",
          icon: <Globe />,
          run: () => {
            window.location.href = href;
          },
        });
      }
      out.push(
        {
          id: "web",
          group: "Search",
          label: raw,
          hint: "Search the web",
          icon: <Search />,
          run: () => searchWeb(raw),
        },
        {
          id: "daily",
          group: "Search",
          label: raw,
          hint: "Search daily.dev",
          icon: <Newspaper />,
          run: () => onSearchDaily(raw),
        }
      );
    }
    for (const f of favorites.filter((f) => !q || matches(q, f.title, f.url)).slice(0, 8)) {
      out.push({
        id: `fav-${f.id}`,
        group: "Favourites",
        label: f.title || hostname(f.url),
        hint: hostname(f.url),
        icon: <Star />,
        run: () => {
          window.location.href = f.url;
        },
      });
    }
    for (const f of feeds.filter((f) => !q || matches(q, f.label))) {
      const Icon = f.icon;
      out.push({
        id: `feed-${f.value}`,
        group: "Feeds",
        label: f.label,
        icon: <Icon />,
        run: () => onFeed(f.value),
      });
    }
    if (q) {
      for (const t of tags.filter((t) => matches(q, t)).slice(0, 6)) {
        out.push({
          id: `tag-${t}`,
          group: "Tags",
          label: `#${t}`,
          icon: <Hash />,
          run: () => onTag(t),
        });
      }
      for (const p of posts.filter((p) => matches(q, p.title, p.source.name)).slice(0, 8)) {
        out.push({
          id: `post-${p.id}`,
          group: "Posts in this feed",
          label: p.title,
          hint: p.source.name,
          icon: <SourceAvatar source={p.source} />,
          run: () => onPost(p),
        });
      }
    }
    out.push(...actions.filter((a) => !q || matches(q, a.label)));
    return out;
  }, [query, favorites, feeds, tags, posts, actions, onFeed, onTag, onSearchDaily, onPost]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (item: CommandItem | undefined) => {
    if (!item) return;
    onOpenChange(false);
    item.run();
  };

  let lastGroup = "";

  return (
    <Dialog onOpenChange={(d) => onOpenChange(d.open)} open={open}>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false} size="xl">
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            className="h-13 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(items.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(items[active]);
              }
            }}
            placeholder="Search the web, open a site, jump to a feed…"
            spellCheck={false}
            value={query}
          />
        </div>
        <div className="max-h-[min(60vh,480px)] overflow-y-auto p-2" ref={listRef}>
          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-muted-foreground text-sm">No matches.</p>
          )}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {header && (
                  <div className="px-3 pt-3 pb-1 font-medium text-muted-foreground text-xs">
                    {header}
                  </div>
                )}
                <button
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-start text-sm outline-none",
                    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
                    i === active && "bg-accent"
                  )}
                  data-index={i}
                  onClick={() => run(item)}
                  onMouseMove={() => setActive(i)}
                  type="button"
                >
                  {item.icon}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && (
                    <span className="shrink-0 text-muted-foreground text-xs">{item.hint}</span>
                  )}
                  {i === active && <CornerDownLeft className="size-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t px-4 py-2 text-muted-foreground text-xs">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Enter</Kbd> select
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
