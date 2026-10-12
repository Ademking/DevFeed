import { useCallback, useEffect, useState } from "react";
import type { TempUnit, WeatherPlace } from "@/lib/weather";

const PREFIX = "bdd:";

export const readStore = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

export const writeStore = (key: string, value: unknown) => {
  try {
    if (value === undefined) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or unavailable; caching is best-effort
  }
};

/** localStorage-backed state that stays in sync across open new tabs. */
export const useStored = <T>(key: string, fallback: T) => {
  const [value, setValue] = useState<T>(() => readStore(key, fallback));

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFIX + key) setValue(readStore(key, fallback));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // fallback is intentionally excluded: callers pass literals
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        writeStore(key, resolved);
        return resolved;
      });
    },
    [key]
  );

  return [value, update] as const;
};

export type Theme = "dark" | "light";
export type Layout = "reader" | "cards";

export interface Settings {
  token: string;
  layout: Layout;
  showSummaries: boolean;
  showImages: boolean;
  openInNewTab: boolean;
  showFavorites: boolean;
  showClock: boolean;
  showWeather: boolean;
  weatherPlace: WeatherPlace | null;
  tempUnit: TempUnit;
  background:
    | { kind: "none" }
    | { kind: "url"; url: string }
    | { kind: "upload"; name: string; updatedAt: number };
  /** 0 to 1 */
  bgOpacity: number;
  /** Pixels */
  bgBlur: number;
  feedTitleSize: number;
  articleTitleSize: number;
  readingSize: number;
  /** Minutes before a cached feed is refetched on a new tab. 0 = manual only. */
  refreshMinutes: number;
}

export const defaultSettings: Settings = {
  token: "",
  layout: "reader",
  showSummaries: true,
  showImages: true,
  openInNewTab: true,
  showFavorites: true,
  showClock: true,
  showWeather: true,
  weatherPlace: null,
  tempUnit: "celsius",
  background: { kind: "none" },
  bgOpacity: 0.15,
  bgBlur: 0,
  refreshMinutes: 180,
  feedTitleSize: 17,
  articleTitleSize: 38,
  readingSize: 17,
};

export const useSettings = () => {
  const [stored, setStored] = useStored<Partial<Settings>>("settings", {});
  const settings: Settings = { ...defaultSettings, ...stored };
  // Layout names from v1.0
  if ((settings.layout as string) === "grid") settings.layout = "cards";
  if (settings.layout !== "cards") settings.layout = "reader";
  const update = useCallback(
    (patch: Partial<Settings>) => setStored((prev) => ({ ...prev, ...patch })),
    [setStored]
  );
  return [settings, update] as const;
};

export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
};
