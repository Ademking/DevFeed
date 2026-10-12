import { ImagePlus, Link2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { BACKGROUND_KEY, useBackgroundSrc } from "@/hooks/use-background";
import { idbDelete, idbSet } from "@/lib/idb";
import type { Settings } from "@/lib/storage";

const MAX_UPLOAD_MB = 15;

/** "4kwallpapers.com/…/windows-11-dark.jpg" instead of the full address. */
const shortUrl = (url: string) => {
  try {
    const u = new URL(url);
    const file = u.pathname.split("/").filter(Boolean).pop();
    const host = u.hostname.replace(/^www\./, "");
    return file ? `${host}/…/${decodeURIComponent(file)}` : host;
  } catch {
    return url;
  }
};

const SliderRow = ({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) => (
  <div className="flex items-center gap-4">
    <span className="w-16 shrink-0 text-sm">{label}</span>
    <Slider
      aria-label={[label]}
      className="flex-1"
      max={max}
      min={min}
      onValueChange={(d) => onChange(d.value[0])}
      step={step}
      value={[value]}
    />
    <span className="w-10 shrink-0 text-end text-muted-foreground text-xs tabular-nums">
      {format(value)}
    </span>
  </div>
);

export const BackgroundSettings = ({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bg = settings.background;
  const preview = useBackgroundSrc(bg);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image.");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`Pick an image under ${MAX_UPLOAD_MB} MB.`);
      return;
    }
    setError(null);
    await idbSet(BACKGROUND_KEY, file);
    onChange({ background: { kind: "upload", name: file.name, updatedAt: Date.now() } });
  };

  const useUrl = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
      setError(null);
      idbDelete(BACKGROUND_KEY);
      onChange({ background: { kind: "url", url: parsed.href } });
      setUrl("");
    } catch {
      setError("Enter an image link that starts with https://");
    }
  };

  const remove = () => {
    idbDelete(BACKGROUND_KEY);
    onChange({ background: { kind: "none" } });
    setError(null);
  };

  return (
    <div className="flex flex-col gap-3 py-2.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">Background</div>
          <div
            className="truncate text-muted-foreground text-xs"
            title={bg.kind === "url" ? bg.url : bg.kind === "upload" ? bg.name : undefined}
          >
            {bg.kind === "upload"
              ? bg.name
              : bg.kind === "url"
                ? shortUrl(bg.url)
                : "A faint image behind everything"}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={() => fileRef.current?.click()} size="sm" variant="outline">
            <ImagePlus />
            Upload
          </Button>
          {bg.kind !== "none" && (
            <Button aria-label="Remove background" onClick={remove} size="icon-sm" variant="ghost">
              <Trash2 />
            </Button>
          )}
        </div>
        <input
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = "";
          }}
          ref={fileRef}
          type="file"
        />
      </div>

      <form className="flex gap-2" onSubmit={useUrl}>
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute inset-s-2.5 top-2 size-4 text-muted-foreground" />
          <Input
            className="ps-8"
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Or paste an image link"
            spellCheck={false}
            value={url}
          />
        </div>
        <Button disabled={!url.trim()} type="submit" variant="outline">
          Use
        </Button>
      </form>

      {error && <p className="text-destructive-foreground text-xs">{error}</p>}

      {preview && (
        <div className="flex items-center gap-4">
          {/* Shows the image at the chosen strength over the page colour. */}
          <div className="relative h-20 w-32 shrink-0 overflow-hidden border bg-background">
            <img
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
              src={preview}
              style={{
                opacity: settings.bgOpacity,
                filter: settings.bgBlur ? `blur(${settings.bgBlur / 4}px)` : undefined,
              }}
            />
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <SliderRow
              format={(v) => `${Math.round(v * 100)}%`}
              label="Opacity"
              max={0.6}
              min={0.05}
              onChange={(v) => onChange({ bgOpacity: v })}
              step={0.01}
              value={settings.bgOpacity}
            />
            <SliderRow
              format={(v) => `${v}px`}
              label="Blur"
              max={24}
              min={0}
              onChange={(v) => onChange({ bgBlur: v })}
              step={1}
              value={settings.bgBlur}
            />
          </div>
        </div>
      )}
    </div>
  );
};
