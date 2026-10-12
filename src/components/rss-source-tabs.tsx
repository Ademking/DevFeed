import { useState } from "react";
import { ScrollRow } from "@/components/scroll-row";
import type { RssFeed } from "@/lib/rss";
import { cn } from "@/lib/utils";

interface RssSourceTabsProps {
  feeds: RssFeed[];
  active: string | null;
  onSelect: (url: string | null) => void;
  /** Called when a tab is dropped on another; "All" always stays first. */
  onReorder: (fromUrl: string, toUrl: string) => void;
}

/** "All" plus one tab per enabled feed. Drag a feed tab to reorder. */
export const RssSourceTabs = ({ feeds, active, onSelect, onReorder }: RssSourceTabsProps) => {
  const [dragUrl, setDragUrl] = useState<string | null>(null);
  const [overUrl, setOverUrl] = useState<string | null>(null);

  const tabClass = (selected: boolean) =>
    cn(
      "shrink-0 px-2.5 py-1 text-xs transition-colors",
      selected
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    );

  return (
    <ScrollRow>
      <button className={tabClass(active === null)} onClick={() => onSelect(null)} type="button">
        All
      </button>
      {feeds.map((feed) => (
        <button
          className={cn(
            tabClass(active === feed.url),
            "cursor-grab active:cursor-grabbing",
            dragUrl === feed.url && "opacity-40",
            overUrl === feed.url && dragUrl !== feed.url && "outline outline-1 outline-foreground/60"
          )}
          dir="auto"
          draggable
          key={feed.url}
          onClick={() => onSelect(feed.url)}
          onDragEnd={() => {
            setDragUrl(null);
            setOverUrl(null);
          }}
          onDragOver={(e) => {
            if (!dragUrl) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOverUrl(feed.url);
          }}
          onDragStart={(e) => {
            setDragUrl(feed.url);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", feed.title);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragUrl) onReorder(dragUrl, feed.url);
            setDragUrl(null);
            setOverUrl(null);
          }}
          title="Drag to reorder"
          type="button"
        >
          {feed.title}
        </button>
      ))}
    </ScrollRow>
  );
};
