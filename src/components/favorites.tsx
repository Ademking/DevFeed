import { Menu as ArkMenu } from "@ark-ui/react/menu";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { faviconUrl } from "@/lib/favicon";
import { hostname } from "@/lib/format";
import { useStored } from "@/lib/storage";
import { cn } from "@/lib/utils";

export interface Favorite {
  id: string;
  url: string;
  title: string;
}

const normalizeUrl = (raw: string) => {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

const Favicon = ({ fav }: { fav: Favorite }) => {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(fav.url);
  if (!src || failed) {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center bg-muted-foreground/20 font-semibold text-[9px] text-foreground/80 uppercase">
        {(fav.title || hostname(fav.url)).charAt(0)}
      </span>
    );
  }
  return (
    <img alt="" className="size-4 shrink-0" onError={() => setFailed(true)} src={src} />
  );
};

const FavoriteDialog = ({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: Favorite | null;
  onClose: () => void;
  onSave: (fav: { url: string; title: string }) => void;
}) => {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(initial?.url ?? "");
      setTitle(initial?.title ?? "");
      setTouched(false);
    }
  }, [open, initial]);

  const normalized = normalizeUrl(url);
  const invalid = touched && url.trim() !== "" && !normalized;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!normalized) return;
    // An empty name is allowed: the favourite then shows as an icon only.
    onSave({ url: normalized, title: title.trim() });
  };

  return (
    <Dialog onOpenChange={(d) => !d.open && onClose()} open={open}>
      <DialogContent size="sm">
        <form className="contents" onSubmit={submit}>
          <DialogHeader title={initial ? "Edit favourite" : "Add a favourite"} />
          <DialogBody className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-medium text-sm">Address</span>
              <Input
                aria-invalid={invalid || undefined}
                autoFocus
                onBlur={() => setTouched(true)}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="github.com"
                spellCheck={false}
                value={url}
              />
              {invalid && (
                <span className="text-destructive-foreground text-xs">
                  Enter a web address, like github.com
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-medium text-sm">
                Name <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <Input
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Leave empty to show only the icon"
                value={title}
              />
            </label>
          </DialogBody>
          <DialogFooter>
            <Button onClick={onClose} variant="ghost">
              Cancel
            </Button>
            <Button disabled={!url.trim()} type="submit">
              {initial ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/** Favourites in the sidebar: named sites as rows, icon-only sites as a row of icons. */
export const FavoritesSection = () => {
  const [favorites, setFavorites] = useStored<Favorite[]>("favorites", []);
  const [editing, setEditing] = useState<Favorite | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const openDialog = (fav: Favorite | null) => {
    setEditing(fav);
    setDialogOpen(true);
  };

  const save = ({ url, title }: { url: string; title: string }) => {
    setFavorites((prev) =>
      editing
        ? prev.map((f) => (f.id === editing.id ? { ...f, url, title } : f))
        : [...prev, { id: crypto.randomUUID(), url, title }]
    );
    setDialogOpen(false);
  };

  const remove = (id: string) => setFavorites((prev) => prev.filter((f) => f.id !== id));

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setFavorites((prev) => {
      const from = prev.findIndex((f) => f.id === dragId);
      const to = prev.findIndex((f) => f.id === targetId);
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const item = (fav: Favorite, iconOnly: boolean) => {
    const label = fav.title || hostname(fav.url);
    return (
      <Menu
        key={fav.id}
        onSelect={(d) => {
          if (d.value === "edit") openDialog(fav);
          if (d.value === "remove") remove(fav.id);
          if (d.value === "new-tab") window.open(fav.url, "_blank", "noopener");
        }}
        positioning={{ placement: "right-start" }}
      >
        <ArkMenu.ContextTrigger asChild>
          <a
            aria-label={label}
            className={cn(
              "flex h-8 items-center gap-2.5 text-muted-foreground text-sm outline-none transition-colors",
              "hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground/40",
              iconOnly ? "w-8 justify-center" : "w-full justify-center px-2.5 xl:justify-start",
              dragId === fav.id && "opacity-40",
              overId === fav.id && dragId !== fav.id && "bg-accent"
            )}
            draggable
            href={fav.url}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverId(fav.id);
            }}
            onDragStart={(e) => {
              setDragId(fav.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(fav.id);
            }}
            title={`${label}\n${fav.url}\nRight-click to edit`}
          >
            <Favicon fav={fav} />
            {!iconOnly && <span className="hidden truncate xl:inline">{fav.title}</span>}
          </a>
        </ArkMenu.ContextTrigger>
        <MenuContent>
          <MenuItem value="new-tab">
            <ExternalLink />
            Open in new tab
          </MenuItem>
          <MenuItem value="edit">
            <Pencil />
            Edit
          </MenuItem>
          <MenuSeparator />
          <MenuItem value="remove" variant="destructive">
            <Trash2 />
            Remove
          </MenuItem>
        </MenuContent>
      </Menu>
    );
  };

  const named = favorites.filter((f) => f.title);
  const iconOnly = favorites.filter((f) => !f.title);

  return (
    <nav aria-label="Favourites" className="flex flex-col gap-0.5 border-t pt-3">
      <div className="flex items-center justify-center pb-1 xl:justify-between xl:ps-2.5">
        <span className="hidden font-medium text-muted-foreground text-xs xl:inline">
          Favourites
        </span>
        <Button
          aria-label="Add a favourite site"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => openDialog(null)}
          size="icon-xs"
          title="Add a favourite site"
          variant="ghost"
        >
          <Plus />
        </Button>
      </div>

      {named.map((fav) => item(fav, false))}

      {iconOnly.length > 0 && (
        <div className="flex flex-col items-center gap-0.5 xl:flex-row xl:flex-wrap xl:items-start">
          {iconOnly.map((fav) => item(fav, true))}
        </div>
      )}

      {favorites.length === 0 && (
        <button
          className="hidden px-2.5 py-1 text-start text-muted-foreground/70 text-xs hover:text-foreground xl:block"
          onClick={() => openDialog(null)}
          type="button"
        >
          Add sites you visit often.
        </button>
      )}

      <FavoriteDialog
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSave={save}
        open={dialogOpen}
      />
    </nav>
  );
};
