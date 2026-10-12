import { Eye, EyeOff, ExternalLink, Trash2 } from "lucide-react";
import { createListCollection } from "@ark-ui/react/select";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WeatherSettings } from "@/components/weather-settings";
import { BackgroundSettings } from "@/components/background-settings";
import { FONT_PRESETS, getFontPreset } from "@/lib/fonts";
import { defaultSettings, readStore, type Settings, type Theme } from "@/lib/storage";

export const TOKEN_URL = "https://daily.dev/settings/api/";

const REFRESH_OPTIONS = [
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
  { value: 180, label: "3h" },
  { value: 720, label: "12h" },
  { value: 0, label: "Manual" },
];

const fontCollection = createListCollection({
  items: FONT_PRESETS,
  itemToString: (p) => p.label,
  itemToValue: (p) => p.value,
});

const SIZE_CONTROLS = [
  { key: "feedTitleSize", title: "Feed titles", min: 13, max: 30 },
  { key: "articleTitleSize", title: "Article title", min: 22, max: 80 },
  { key: "readingSize", title: "Article text", min: 13, max: 30 },
] as const;

const SizeSlider = ({
  title,
  value,
  min,
  max,
  onChange,
}: {
  title: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) => (
  <div className="flex items-center gap-4 py-2">
    <span className="w-28 shrink-0 text-sm">{title}</span>
    <Slider
      aria-label={[title]}
      className="flex-1"
      max={max}
      min={min}
      onValueChange={(d) => onChange(d.value[0])}
      step={1}
      value={[value]}
    />
    <span className="w-10 shrink-0 text-end text-muted-foreground text-xs tabular-nums">
      {value}px
    </span>
  </div>
);

const Row = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-6 py-2.5">
    <div className="min-w-0">
      <div className="font-medium text-sm">{title}</div>
      {description && (
        <div className="text-muted-foreground text-xs">{description}</div>
      )}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  font: string;
  onFontChange: (font: string) => void;
  onClearCache: () => void;
  /** Section to scroll to when the dialog opens. */
  focusSection?: "weather" | null;
}

export const SettingsDialog = ({
  open,
  onOpenChange,
  settings,
  onChange,
  theme,
  onThemeChange,
  font,
  onFontChange,
  onClearCache,
  focusSection,
}: SettingsDialogProps) => {
  const [token, setToken] = useState(settings.token);
  const [reveal, setReveal] = useState(false);
  const rate = open
    ? readStore<{ remaining: number; limit: number; at: number } | null>(
        "ratelimit",
        null
      )
    : null;

  useEffect(() => {
    if (open) setToken(settings.token);
  }, [open, settings.token]);

  return (
    <Dialog onOpenChange={(d) => onOpenChange(d.open)} open={open}>
      <DialogContent size="md">
        <DialogHeader
          description="Saved in this browser only."
          title="Settings"
        />
        <DialogBody className="flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <label className="font-medium text-sm" htmlFor="bdd-token">
              daily.dev API token
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  autoComplete="off"
                  className="pe-9 font-mono"
                  id="bdd-token"
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your personal access token"
                  spellCheck={false}
                  type={reveal ? "text" : "password"}
                  value={token}
                />
                <Button
                  aria-label={reveal ? "Hide token" : "Show token"}
                  className="absolute inset-e-1 top-1"
                  onClick={() => setReveal((r) => !r)}
                  size="icon-xs"
                  variant="ghost"
                >
                  {reveal ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              <Button
                disabled={token.trim() === settings.token}
                onClick={() => onChange({ token: token.trim() })}
              >
                Save
              </Button>
            </div>
            <a
              className="inline-flex w-fit items-center gap-1 text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
              href={TOKEN_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              Generate a token in daily.dev settings
              <ExternalLink className="size-3" />
            </a>
          </section>

          <section className="divide-y">
            <Row title="Theme">
              <ToggleGroup
                multiple={false}
                onValueChange={(d) => d.value[0] && onThemeChange(d.value[0] as Theme)}
                size="sm"
                spacing={1}
                value={[theme]}
                variant="outline"
              >
                <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
                <ToggleGroupItem value="light">Light</ToggleGroupItem>
              </ToggleGroup>
            </Row>
            <BackgroundSettings onChange={onChange} settings={settings} />
            <Row description={getFontPreset(font).description} title="Font">
              <Select
                collection={fontCollection}
                onValueChange={(d) => d.value[0] && onFontChange(d.value[0])}
                positioning={{ sameWidth: false }}
                value={[getFontPreset(font).value]}
              >
                <SelectTrigger className="w-40" size="sm">
                  <SelectValue
                    style={{ fontFamily: getFontPreset(font).heading }}
                  />
                </SelectTrigger>
                <SelectContent className="w-64">
                  {FONT_PRESETS.map((p) => (
                    <SelectItem item={p} key={p.value}>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[15px]" style={{ fontFamily: p.heading }}>
                          {p.label}
                        </span>
                        <span className="text-muted-foreground text-xs">{p.description}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row
              description="How old a saved feed can get before a new tab fetches it again."
              title="Auto refresh"
            >
              <ToggleGroup
                multiple={false}
                onValueChange={(d) =>
                  d.value[0] !== undefined &&
                  onChange({ refreshMinutes: Number(d.value[0]) })
                }
                size="sm"
                spacing={1}
                value={[String(settings.refreshMinutes)]}
                variant="outline"
              >
                {REFRESH_OPTIONS.map((o) => (
                  <ToggleGroupItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Row>
            <div className="flex flex-col py-2.5">
              <div className="flex items-center justify-between gap-6 pb-1">
                <div>
                  <div className="font-medium text-sm">Text sizes</div>
                  <div className="text-muted-foreground text-xs">
                    The reading pane's A buttons zoom on top of these.
                  </div>
                </div>
                <Button
                  disabled={SIZE_CONTROLS.every((c) => settings[c.key] === defaultSettings[c.key])}
                  onClick={() =>
                    onChange(
                      Object.fromEntries(SIZE_CONTROLS.map((c) => [c.key, defaultSettings[c.key]]))
                    )
                  }
                  size="xs"
                  variant="ghost"
                >
                  Reset
                </Button>
              </div>
              {SIZE_CONTROLS.map((c) => (
                <SizeSlider
                  key={c.key}
                  max={c.max}
                  min={c.min}
                  onChange={(v) => onChange({ [c.key]: v })}
                  title={c.title}
                  value={settings[c.key]}
                />
              ))}
            </div>
            <Row description="Show the TL;DR under each title in the list" title="Summaries">
              <Switch
                checked={settings.showSummaries}
                onCheckedChange={(d) => onChange({ showSummaries: d.checked })}
              />
            </Row>
            <Row description="Show cover images" title="Thumbnails">
              <Switch
                checked={settings.showImages}
                onCheckedChange={(d) => onChange({ showImages: d.checked })}
              />
            </Row>
            <Row description="Your sites, in the sidebar" title="Favourites">
              <Switch
                checked={settings.showFavorites}
                onCheckedChange={(d) => onChange({ showFavorites: d.checked })}
              />
            </Row>
            <Row description="Large time on the welcome screen" title="Clock">
              <Switch
                checked={settings.showClock}
                onCheckedChange={(d) => onChange({ showClock: d.checked })}
              />
            </Row>
            <WeatherSettings
              focus={open && focusSection === "weather"}
              onChange={onChange}
              settings={settings}
            />
            <Row title="Open articles in a new tab">
              <Switch
                checked={settings.openInNewTab}
                onCheckedChange={(d) => onChange({ openInNewTab: d.checked })}
              />
            </Row>
          </section>
        </DialogBody>
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-muted-foreground text-xs tabular-nums">
            {rate
              ? `API quota: ${rate.remaining} of ${rate.limit} left`
              : "No API calls yet"}
          </span>
          <Button onClick={onClearCache} size="sm" variant="ghost">
            <Trash2 />
            Clear cache
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
