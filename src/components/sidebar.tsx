import {
  Bookmark,
  Keyboard,
  type LucideIcon,
  MessagesSquare,
  Moon,
  Rss,
  Settings,
  Sparkles,
  Sun,
  TrendingUp,
} from "lucide-react";
import { FavoritesSection } from "@/components/favorites";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Profile } from "@/lib/api";
import type { Theme } from "@/lib/storage";
import { cn } from "@/lib/utils";

export type BaseFeed = "foryou" | "popular" | "discussed" | "bookmarks" | "rss";

export const FEEDS: { value: BaseFeed; label: string; icon: LucideIcon }[] = [
  { value: "foryou", label: "For you", icon: Sparkles },
  { value: "popular", label: "Popular", icon: TrendingUp },
  { value: "discussed", label: "Most discussed", icon: MessagesSquare },
  { value: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { value: "rss", label: "RSS feeds", icon: Rss },
];

const NavItem = ({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <Tooltip positioning={{ placement: "right" }}>
    <TooltipTrigger asChild>
      <button
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none transition-colors",
          "justify-center xl:justify-start",
          "focus-visible:ring-2 focus-visible:ring-foreground/40",
          active
            ? "bg-accent font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        )}
        onClick={onClick}
        type="button"
      >
        <Icon className={cn("size-4 shrink-0", active && "text-foreground")} />
        <span className="hidden truncate xl:inline">
          {label}
        </span>
      </button>
    </TooltipTrigger>
    <TooltipContent className="xl:hidden">{label}</TooltipContent>
  </Tooltip>
);

interface SidebarProps {
  active: BaseFeed | null;
  showFavorites: boolean;
  profile: Profile | null;
  theme: Theme;
  target: "_blank" | "_self";
  onFeed: (feed: BaseFeed) => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  /** Back to the starting view: no post open, welcome screen showing. */
  onHome: () => void;
}

export const Sidebar = ({
  active,
  showFavorites,
  profile,
  theme,
  target,
  onFeed,
  onToggleTheme,
  onOpenSettings,
  onOpenShortcuts,
  onHome,
}: SidebarProps) => (
  <aside className="hidden h-full w-14 shrink-0 flex-col border-e bg-sidebar/70 md:flex xl:w-56">
    <button
      className="flex h-14 shrink-0 items-center justify-center gap-2.5 px-4 outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 xl:justify-start"
      onClick={onHome}
      title="Home"
      type="button"
    >
      <Logo />
      <span className="hidden font-heading font-semibold text-sm tracking-tight xl:inline">
        DevFeed
      </span>
    </button>

    <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 py-3">
      <div className="flex flex-col gap-0.5">
        {FEEDS.filter((f) => f.value !== "rss").map((f) => (
          <NavItem
            active={active === f.value}
            icon={f.icon}
            key={f.value}
            label={f.label}
            onClick={() => onFeed(f.value)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-0.5 border-t pt-3">
        {FEEDS.filter((f) => f.value === "rss").map((f) => (
          <NavItem
            active={active === f.value}
            icon={f.icon}
            key={f.value}
            label={f.label}
            onClick={() => onFeed(f.value)}
          />
        ))}
      </div>

      {showFavorites && <FavoritesSection />}
    </nav>

    <div className="flex shrink-0 flex-col gap-0.5 border-t p-2">
      <NavItem
        active={false}
        icon={theme === "dark" ? Sun : Moon}
        label={theme === "dark" ? "Light mode" : "Dark mode"}
        onClick={onToggleTheme}
      />
      <NavItem active={false} icon={Keyboard} label="Shortcuts" onClick={onOpenShortcuts} />
      <NavItem active={false} icon={Settings} label="Settings" onClick={onOpenSettings} />
      {profile && (
        <a
          className="mt-1 flex items-center justify-center gap-2.5 rounded-lg p-1.5 outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-foreground/40 xl:justify-start"
          href={profile.permalink}
          rel="noopener noreferrer"
          target={target}
          title="Your daily.dev profile"
        >
          <Avatar size="sm">
            {profile.image && <AvatarImage alt="" src={profile.image} />}
            <AvatarFallback>{(profile.name ?? profile.username ?? "?").slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 flex-1 truncate font-medium text-sm xl:block">
            {profile.name ?? profile.username}
          </span>
        </a>
      )}
    </div>
  </aside>
);
