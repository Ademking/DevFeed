import {
  CheckCheck,
  CircleDot,
  Hash,
  Keyboard,
  LayoutGrid,
  Moon,
  RefreshCw,
  Rows3,
  Rss,
  Search,
  Settings as SettingsIcon,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  EmptyState,
  ErrorState,
  FeedSkeleton,
  ConnectPrompt,
} from "@/components/feed-states";
import { BackgroundLayer } from "@/components/background-layer";
import { type CommandItem, CommandMenu } from "@/components/command-menu";
import type { Favorite } from "@/components/favorites";
import { PostCard, type PostItemProps, PostRow } from "@/components/post-item";
import { Reader, ZOOM } from "@/components/reader";
import { SettingsDialog } from "@/components/settings-dialog";
import { RssFeedsDialog } from "@/components/rss-feeds-dialog";
import { ScrollRow } from "@/components/scroll-row";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { Welcome } from "@/components/welcome";
import { type BaseFeed, FEEDS, Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFeed } from "@/hooks/use-feed";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useProfile } from "@/hooks/use-profile";
import { type GrantResult, useRss } from "@/hooks/use-rss";
import { addBookmark, type FeedKey, type Post, removeBookmark } from "@/lib/api";
import { applyFontPreset, DEFAULT_FONT } from "@/lib/fonts";
import { hostname, isWebUrl, timeAgo } from "@/lib/format";
import { BUILTIN_FEEDS, migrateFeeds, type RssFeed } from "@/lib/rss";
import { MOD_KEY } from "@/lib/shortcuts";
import { applyTheme, type Theme, useSettings, useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: 7, label: "Week" },
  { value: 30, label: "Month" },
  { value: 365, label: "Year" },
] as const;

const MAX_READ = 2000;
const SIDEBAR_TAGS = 10;

type Filter = { kind: "tag"; tag: string } | { kind: "search"; q: string };

const IconButton = ({
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

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  !!el.closest("input, textarea, select, [contenteditable=true]");

export const App = () => {
  const [settings, updateSettings] = useSettings();
  const [theme, setTheme] = useStored<Theme>("theme", "dark");
  const [font, setFont] = useStored<string>("font", DEFAULT_FONT);
  const [zoom, setZoom] = useStored<number>("readerZoom", 1);
  const [unreadOnly, setUnreadOnly] = useStored<boolean>("unreadOnly", false);
  const [favorites] = useStored<Favorite[]>("favorites", []);
  const [storedRssFeeds, setRssFeeds] = useStored<RssFeed[]>("rssFeeds", BUILTIN_FEEDS);
  const rssFeeds = useMemo(() => migrateFeeds(storedRssFeeds), [storedRssFeeds]);
  const [grantResult, setGrantResult] = useState<GrantResult | null>(null);
  const [rssSource, setRssSource] = useState<string | null>(null);
  const [rssDialogOpen, setRssDialogOpen] = useState(false);
  const [base, setBase] = useStored<BaseFeed>("feed", "foryou");
  const [period, setPeriod] = useStored<7 | 30 | 365>("period", 7);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [readIds, setReadIds] = useStored<string[]>("read", []);
  const [bookmarkIds, setBookmarkIds] = useStored<string[]>("bookmarks", []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"weather" | null>(null);
  const [commentsSignal, setCommentsSignal] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const isWide = useMediaQuery("(min-width: 1024px)");

  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => applyFontPreset(font), [font]);

  // Before paint, so a new tab never flashes the default sizes.
  useLayoutEffect(() => {
    const s = document.documentElement.style;
    s.setProperty("--feed-title-size", `${settings.feedTitleSize}px`);
    s.setProperty("--article-title-size", `${settings.articleTitleSize}px`);
    s.setProperty("--reading-size", `${settings.readingSize}px`);
    s.setProperty("--reader-zoom", String(zoom));
  }, [settings.feedTitleSize, settings.articleTitleSize, settings.readingSize, zoom]);

  const feedKey: FeedKey = useMemo(() => {
    if (filter) return filter;
    if (base === "discussed") return { kind: "discussed", period };
    return { kind: base };
  }, [filter, base, period]);

  const isRss = feedKey.kind === "rss";
  const daily = useFeed(settings.token, feedKey, settings.refreshMinutes);
  const rss = useRss(isRss, rssFeeds);
  const feed = isRss ? rss : daily;
  const profile = useProfile(settings.token);
  const enabledRss = useMemo(() => rssFeeds.filter((f) => f.enabled), [rssFeeds]);
  const activeSource = isRss && enabledRss.some((f) => f.url === rssSource) ? rssSource : null;
  const allPosts = useMemo(
    () =>
      feed.posts.filter(
        (p) => isWebUrl(p.url) && (!activeSource || p.source.id === activeSource)
      ),
    [feed.posts, activeSource]
  );

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const bookmarkSet = useMemo(() => new Set(bookmarkIds), [bookmarkIds]);
  const unread = allPosts.filter((p) => !readSet.has(p.id)).length;

  // "Unread only" hides posts read before the filter was turned on or the feed
  // loaded. Posts read since then stay put, so the list doesn't jump under you.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setHiddenIds(new Set(readIds)), [unreadOnly, feedKey, feed.fetchedAt]);
  const posts = useMemo(
    () => (unreadOnly ? allPosts.filter((p) => !hiddenIds.has(p.id)) : allPosts),
    [unreadOnly, allPosts, hiddenIds]
  );

  // Nothing opens on its own: the reading pane starts on the welcome screen
  // until a post is picked (click, J or K).
  const inline = settings.layout === "reader" && isWide;
  const shownIndex = posts.findIndex((p) => p.id === selectedId);
  const shown = shownIndex >= 0 ? posts[shownIndex] : null;
  // Held-down J/K fires faster than React re-renders; step from the latest index.
  const indexRef = useRef(shownIndex);
  indexRef.current = shownIndex;

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allPosts) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, SIDEBAR_TAGS)
      .map(([t]) => t);
  }, [allPosts]);

  // The bookmarks feed is the source of truth for what's bookmarked.
  useEffect(() => {
    if (feedKey.kind === "bookmarks" && allPosts.length) {
      setBookmarkIds((prev) => [...new Set([...prev, ...allPosts.map((p) => p.id)])]);
    }
  }, [feedKey.kind, allPosts, setBookmarkIds]);

  // A new feed starts at the top with nothing picked.
  useEffect(() => {
    setSelectedId(null);
    setSheetOpen(false);
    listRef.current?.scrollTo({ top: 0 });
  }, [feedKey]);

  const markRead = useCallback(
    (ids: string[]) =>
      setReadIds((prev) => {
        const fresh = ids.filter((id) => !prev.includes(id));
        return fresh.length ? [...fresh, ...prev].slice(0, MAX_READ) : prev;
      }),
    [setReadIds]
  );

  const select = useCallback(
    (post: Post, { scroll = false } = {}) => {
      setSelectedId(post.id);
      markRead([post.id]);
      if (!inline) setSheetOpen(true);
      if (scroll) {
        listRef.current
          ?.querySelector(`[data-post-id="${CSS.escape(post.id)}"]`)
          ?.scrollIntoView({ block: "nearest" });
      }
    },
    [inline, markRead]
  );

  // Set when J is pressed on the last post: once the next page arrives, move to it.
  const advanceAfterLoad = useRef(false);

  const step = useCallback(
    (delta: 1 | -1) => {
      if (!posts.length) return;
      const current = indexRef.current;
      if (delta === 1 && current === posts.length - 1) {
        if (feed.hasNext) {
          advanceAfterLoad.current = true;
          feed.loadMore();
        }
        return;
      }
      const from = current === -1 ? (delta === 1 ? -1 : posts.length) : current;
      const nextIndex = Math.min(posts.length - 1, Math.max(0, from + delta));
      const next = posts[nextIndex];
      if (next) {
        indexRef.current = nextIndex;
        setSelectedId(next.id);
        markRead([next.id]);
        listRef.current
          ?.querySelector(`[data-post-id="${CSS.escape(next.id)}"]`)
          ?.scrollIntoView({ block: "nearest" });
      }
    },
    [posts, markRead, feed]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when a page arrives
  useEffect(() => {
    if (advanceAfterLoad.current && indexRef.current < posts.length - 1) {
      advanceAfterLoad.current = false;
      step(1);
    }
  }, [posts.length]);

  // Load the next page when the end of the list scrolls into view.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(feed.loadMore);
  loadMoreRef.current = feed.loadMore;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !feed.hasNext) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMoreRef.current();
      },
      { root: listRef.current, rootMargin: "0px 0px 600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [feed.hasNext, posts.length]);

  const toggleBookmark = useCallback(
    async (post: Post) => {
      const was = bookmarkSet.has(post.id);
      const apply = (on: boolean) =>
        setBookmarkIds((prev) =>
          on ? [...new Set([...prev, post.id])] : prev.filter((id) => id !== post.id)
        );
      apply(!was);
      try {
        if (was) {
          await removeBookmark(settings.token, post.id);
          if (feedKey.kind === "bookmarks") feed.removePost(post.id);
        } else {
          await addBookmark(settings.token, post.id);
        }
      } catch {
        apply(was);
      }
    },
    [bookmarkSet, setBookmarkIds, settings.token, feedKey.kind, feed]
  );

  const openArticle = useCallback(
    (post: Post) => {
      markRead([post.id]);
      if (settings.openInNewTab) window.open(post.url, "_blank", "noopener");
      else window.location.href = post.url;
    },
    [markRead, settings.openInNewTab]
  );

  const showFeed = useCallback(
    (f: BaseFeed) => {
      setFilter(null);
      setBase(f);
    },
    [setBase]
  );

  const showTag = useCallback((tag: string) => {
    setSheetOpen(false);
    setFilter({ kind: "tag", tag });
  }, []);

  // Rounded to one decimal so repeated 0.1 steps don't drift (0.30000000000000004).
  const clampZoom = (n: number) =>
    Math.round(Math.min(ZOOM.max, Math.max(ZOOM.min, n)) * 10) / 10;
  // Same state as a freshly opened tab: nothing selected, no filter, list at the top.
  const goHome = useCallback(() => {
    setSelectedId(null);
    setSheetOpen(false);
    setFilter(null);
    setRssSource(null);
    listRef.current?.scrollTo({ top: 0 });
  }, []);

  const changeZoom = useCallback((n: number) => setZoom(clampZoom(n)), [setZoom]);
  // Keys step from the latest value, so quick repeated presses all count.
  const stepZoom = useCallback(
    (delta: number) => setZoom((prev) => clampZoom(prev + delta)),
    [setZoom]
  );

  const markAllRead = useCallback(() => {
    markRead(allPosts.map((p) => p.id));
    if (unreadOnly) setHiddenIds(new Set(allPosts.map((p) => p.id)));
  }, [markRead, allPosts, unreadOnly]);

  const commandActions: CommandItem[] = useMemo(
    () => [
      {
        id: "unread",
        group: "Actions",
        label: unreadOnly ? "Show all posts" : "Show only unread posts",
        icon: <CircleDot />,
        run: () => setUnreadOnly(!unreadOnly),
      },
      {
        id: "mark",
        group: "Actions",
        label: "Mark all as read",
        icon: <CheckCheck />,
        run: markAllRead,
      },
      {
        id: "refresh",
        group: "Actions",
        label: "Refresh feed",
        icon: <RefreshCw />,
        run: feed.refresh,
      },
      {
        id: "layout",
        group: "Actions",
        label: settings.layout === "cards" ? "Switch to reader view" : "Switch to card view",
        icon: settings.layout === "cards" ? <Rows3 /> : <LayoutGrid />,
        run: () => updateSettings({ layout: settings.layout === "cards" ? "reader" : "cards" }),
      },
      {
        id: "theme",
        group: "Actions",
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        icon: theme === "dark" ? <Sun /> : <Moon />,
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
      {
        id: "rss",
        group: "Actions",
        label: "Manage RSS feeds",
        icon: <Rss />,
        run: () => setRssDialogOpen(true),
      },
      {
        id: "settings",
        group: "Actions",
        label: "Open settings",
        icon: <SettingsIcon />,
        run: () => setSettingsOpen(true),
      },
      {
        id: "help",
        group: "Actions",
        label: "Keyboard shortcuts",
        icon: <Keyboard />,
        run: () => setHelpOpen(true),
      },
    ],
    [unreadOnly, setUnreadOnly, markAllRead, feed.refresh, settings.layout, updateSettings, theme, setTheme]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (settingsOpen || commandOpen || helpOpen) return;
      switch (e.key) {
        case "/":
          e.preventDefault();
          setCommandOpen(true);
          break;
        case "?":
          setHelpOpen(true);
          break;
        case "u":
          setUnreadOnly(!unreadOnly);
          break;
        case "-":
          stepZoom(-ZOOM.step);
          break;
        case "+":
        case "=":
          stepZoom(ZOOM.step);
          break;
        case "0":
          changeZoom(1);
          break;
        case "j":
        case "ArrowDown":
          if (e.key === "ArrowDown" && !inline && !sheetOpen) return;
          e.preventDefault();
          step(1);
          break;
        case "k":
        case "ArrowUp":
          if (e.key === "ArrowUp" && !inline && !sheetOpen) return;
          e.preventDefault();
          step(-1);
          break;
        case "o":
          if (shown) openArticle(shown);
          break;
        case "Enter":
          if (!shown || e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)
            return;
          if (!inline && !sheetOpen) setSheetOpen(true);
          else openArticle(shown);
          break;
        case "b":
          if (shown && !shown.rss) toggleBookmark(shown);
          break;
        case "c":
          if (shown && !shown.rss) {
            if (!inline) setSheetOpen(true);
            setCommentsSignal((n) => n + 1);
          }
          break;
        case "r":
          feed.refresh();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    feed,
    step,
    shown,
    inline,
    sheetOpen,
    settingsOpen,
    commandOpen,
    helpOpen,
    openArticle,
    toggleBookmark,
    unreadOnly,
    setUnreadOnly,
    stepZoom,
    changeZoom,
  ]);

  const target = settings.openInNewTab ? "_blank" : "_self";
  const isCards = settings.layout === "cards";
  const itemProps = (post: Post): PostItemProps => ({
    post,
    selected: shown?.id === post.id && (inline || sheetOpen),
    isRead: readSet.has(post.id),
    isBookmarked: bookmarkSet.has(post.id),
    showSummary: settings.showSummaries,
    showImage: settings.showImages,
    onSelect: (p) => select(p),
  });

  const title = filter
    ? filter.kind === "tag"
      ? filter.tag
      : `“${filter.q}”`
    : (FEEDS.find((f) => f.value === base)?.label ?? "");
  const loading = feed.status === "loading";
  const busy = feed.status !== "idle" && feed.status !== "error";
  const firstName = profile?.name?.split(" ")[0];

  const reader = shown && (
    <Reader
      commentsSignal={commentsSignal}
      inSheet={!inline}
      isBookmarked={bookmarkSet.has(shown.id)}
      onBookmark={toggleBookmark}
      onNext={() => step(1)}
      onOpen={(p) => markRead([p.id])}
      onPrev={() => step(-1)}
      onTag={showTag}
      onZoom={changeZoom}
      position={{ index: shownIndex, total: posts.length }}
      post={shown}
      target={target}
      zoom={zoom}
      token={settings.token}
    />
  );

  return (
    // isolate: the background layer sits behind the app but above the page colour.
    <div className="isolate flex h-svh flex-col overflow-hidden">
      <BackgroundLayer settings={settings} />
      <div className="flex min-h-0 flex-1">
      <Sidebar
        active={filter ? null : base}
        showFavorites={settings.showFavorites}
        onFeed={showFeed}
        onOpenSettings={() => setSettingsOpen(true)}
        onHome={goHome}
        onOpenShortcuts={() => setHelpOpen(true)}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        profile={profile}
        target={target}
        theme={theme}
      />

      <section
        className={cn(
          "flex min-w-0 flex-col",
          inline ? "w-[clamp(360px,34vw,560px)] shrink-0 border-e" : "flex-1"
        )}
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            {filter &&
              (filter.kind === "tag" ? (
                <Hash className="size-4 shrink-0 self-center" />
              ) : (
                <Search className="size-4 shrink-0 self-center" />
              ))}
            <h1 className="truncate font-heading font-semibold text-[17px]">
              {title}
            </h1>
            {!loading && posts.length > 0 && (
              <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                {unread ? `${unread} unread` : "all read"}
              </span>
            )}
            {filter && (
              <Button
                aria-label="Clear filter"
                className="self-center"
                onClick={() => setFilter(null)}
                size="icon-xs"
                variant="ghost"
              >
                <X />
              </Button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton
              label="Search and commands"
              onClick={() => setCommandOpen(true)}
              shortcut={`${MOD_KEY} K`}
            >
              <Search />
            </IconButton>
            <IconButton
              aria-pressed={unreadOnly}
              className={cn(unreadOnly && "bg-accent")}
              label={unreadOnly ? "Show all posts" : "Show only unread"}
              onClick={() => setUnreadOnly(!unreadOnly)}
              shortcut="U"
            >
              <CircleDot />
            </IconButton>
            <IconButton disabled={!unread} label="Mark all as read" onClick={markAllRead}>
              <CheckCheck />
            </IconButton>
            <IconButton
              disabled={busy}
              label={
                feed.fetchedAt
                  ? `Refresh (updated ${timeAgo(new Date(feed.fetchedAt).toISOString())})`
                  : "Refresh"
              }
              onClick={feed.refresh}
              shortcut="R"
            >
              <RefreshCw className={cn(busy && "animate-spin")} />
            </IconButton>
            <IconButton
              label={isCards ? "Reader view" : "Card view"}
              onClick={() => updateSettings({ layout: isCards ? "reader" : "cards" })}
            >
              {isCards ? <Rows3 /> : <LayoutGrid />}
            </IconButton>
            <span className="contents md:hidden">
              <IconButton
                label={theme === "dark" ? "Light mode" : "Dark mode"}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun /> : <Moon />}
              </IconButton>
              <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
                <SettingsIcon />
              </IconButton>
            </span>
          </div>
        </header>

        <Tabs
          className="shrink-0 border-b px-4 py-2 md:hidden"
          onValueChange={(d) => showFeed(d.value as BaseFeed)}
          value={filter ? null : base}
        >
          <TabsList>
            {FEEDS.map((f) => (
              <TabsTrigger className="h-7 px-2 text-xs" key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {!filter && base === "discussed" && (
          <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2">
            <span className="text-muted-foreground text-xs">Most comments in the past</span>
            <ToggleGroup
              multiple={false}
              onValueChange={(d) =>
                d.value[0] && setPeriod(Number(d.value[0]) as 7 | 30 | 365)
              }
              size="sm"
              spacing={1}
              value={[String(period)]}
            >
              {PERIODS.map((p) => (
                <ToggleGroupItem
                  className="text-xs data-[state=on]:bg-accent"
                  key={p.value}
                  value={String(p.value)}
                >
                  {p.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}

        {isRss && (
          <div className="flex shrink-0 items-center gap-1 border-b px-3 py-2">
            <ScrollRow>
              {[{ url: null, title: "All" }, ...enabledRss].map((src) => (
                <button
                  className={cn(
                    "shrink-0 px-2.5 py-1 text-xs transition-colors",
                    activeSource === src.url
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                  key={src.url ?? "all"}
                  onClick={() => setRssSource(src.url)}
                  type="button"
                >
                  {src.title}
                </button>
              ))}
            </ScrollRow>
            <Button
              className="shrink-0"
              onClick={() => setRssDialogOpen(true)}
              size="xs"
              variant="outline"
            >
              Manage feeds
            </Button>
          </div>
        )}

        {isRss && rss.missingAccess.length > 0 && (
          <div className="flex shrink-0 flex-col gap-2 border-b bg-warning/10 px-4 py-3 text-sm">
            <p>
              {grantResult === "reload" ? (
                <>
                  The extension is running an old manifest. Open <code>chrome://extensions</code>,
                  click Reload on DevFeed, then open a new tab.
                </>
              ) : (
                <>
                  Chrome hasn't allowed DevFeed to read{" "}
                  {rss.missingAccess.length === 1
                    ? hostname(rss.missingAccess[0].replace("/*", ""))
                    : `${rss.missingAccess.length} feed sites`}
                  , so {rss.missingAccess.length === 1 ? "that feed fails" : "those feeds fail"}{" "}
                  to load.
                  {grantResult === "denied" && " Access was declined."}
                </>
              )}
            </p>
            {grantResult !== "reload" && (
              <Button
                className="self-start"
                onClick={() => {
                  setGrantResult(null);
                  rss.grantAccess().then(setGrantResult);
                }}
                size="sm"
              >
                Allow access
              </Button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto" ref={listRef}>
          <div className={cn(isCards ? "p-4" : "p-2")}>
            {!isRss && !settings.token ? (
              <ConnectPrompt
                onOpenRss={() => showFeed("rss")}
                onSave={(token) => updateSettings({ token })}
              />
            ) : feed.status === "error" && feed.error && !posts.length ? (
              <ErrorState
                error={feed.error}
                onOpenSettings={() => setSettingsOpen(true)}
                onRetry={feed.refresh}
              />
            ) : loading && !posts.length ? (
              <FeedSkeleton layout={settings.layout} />
            ) : isRss && !enabledRss.length ? (
              <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
                <Rss className="size-8 text-muted-foreground/60" />
                <p className="text-muted-foreground text-sm">No RSS feeds are turned on.</p>
                <Button onClick={() => setRssDialogOpen(true)} size="sm" variant="outline">
                  Manage feeds
                </Button>
              </div>
            ) : !posts.length && unreadOnly && allPosts.length ? (
              <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
                <CheckCheck className="size-8 text-muted-foreground/60" />
                <p className="text-muted-foreground text-sm">You've read everything here.</p>
                <Button onClick={() => setUnreadOnly(false)} size="sm" variant="outline">
                  Show all posts
                </Button>
              </div>
            ) : !posts.length ? (
              <EmptyState
                message={
                  feedKey.kind === "bookmarks"
                    ? "No bookmarks yet. Press B while reading a post to save it."
                    : feedKey.kind === "search"
                      ? "No posts match that search."
                      : "This feed is empty."
                }
              />
            ) : (
              <>
                {feed.status === "error" && feed.error && (
                  <p className="mx-2 mb-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                    {isRss
                      ? `${feed.error.message} The other feeds loaded.`
                      : `Couldn't refresh: ${feed.error.message} Showing saved posts.`}
                  </p>
                )}
                {isCards ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                    {posts.map((post) => (
                      <PostCard key={post.id} {...itemProps(post)} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-px">
                    {posts.map((post) => (
                      <PostRow key={post.id} {...itemProps(post)} />
                    ))}
                  </div>
                )}
                {feed.hasNext && (
                  // Loads on its own when scrolled near; the button is a fallback.
                  <div className="flex justify-center py-6" ref={sentinelRef}>
                    <Button
                      isLoading={feed.status === "loading-more"}
                      onClick={feed.loadMore}
                      variant="ghost"
                    >
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {inline && (
        <section className="flex min-w-0 flex-1 flex-col">
          {reader ?? (
            <Welcome
              name={firstName}
              onSetupWeather={() => {
                setSettingsSection("weather");
                setSettingsOpen(true);
              }}
              place={settings.weatherPlace}
              showClock={settings.showClock}
              showWeather={settings.showWeather}
              unit={settings.tempUnit}
            />
          )}
        </section>
      )}

      {!inline && (
        <Sheet onOpenChange={(d) => setSheetOpen(d.open)} open={sheetOpen && !!shown}>
          <SheetContent className="max-w-4xl p-0" placement="right">
            {reader}
          </SheetContent>
        </Sheet>
      )}

      </div>

      <SettingsDialog
        focusSection={settingsSection}
        font={font}
        onFontChange={setFont}
        onChange={updateSettings}
        onClearCache={() => {
          for (const k of Object.keys(localStorage)) {
            if (k.startsWith("bdd:feed:") || k === "bdd:profile" || k === "bdd:comments")
              localStorage.removeItem(k);
          }
          window.location.reload();
        }}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) setSettingsSection(null);
        }}
        onThemeChange={setTheme}
        open={settingsOpen}
        settings={settings}
        theme={theme}
      />
      <CommandMenu
        actions={commandActions}
        favorites={favorites}
        feeds={FEEDS}
        onFeed={(f) => showFeed(f as BaseFeed)}
        onOpenChange={setCommandOpen}
        onPost={select}
        onSearchDaily={(q) => setFilter({ kind: "search", q })}
        onTag={showTag}
        open={commandOpen}
        posts={allPosts}
        tags={topTags}
      />
      <ShortcutsDialog onOpenChange={setHelpOpen} open={helpOpen} />
      <RssFeedsDialog
        feeds={rssFeeds}
        onChange={setRssFeeds}
        onOpenChange={setRssDialogOpen}
        open={rssDialogOpen}
      />
    </div>
  );
};
