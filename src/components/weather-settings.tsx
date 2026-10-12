import { LocateFixed, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Settings } from "@/lib/storage";
import { currentPlace, searchPlaces, type TempUnit, type WeatherPlace } from "@/lib/weather";

export const WeatherSettings = ({
  settings,
  onChange,
  focus,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  /** Scrolls here and focuses the city search, when opened from the welcome screen. */
  focus?: boolean;
}) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!focus) return;
    // Wait a frame for the dialog to lay out before scrolling.
    const id = requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ block: "start" });
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [focus]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WeatherPlace[] | null>(null);
  const [busy, setBusy] = useState<"search" | "locate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const place = settings.weatherPlace;

  const choose = (p: WeatherPlace, approximate = false) => {
    const { name, detail, latitude, longitude } = p;
    onChange({ weatherPlace: { name, detail, latitude, longitude }, showWeather: true });
    setNote(
      approximate
        ? `Your browser didn't share a precise location, so this is an estimate from your IP address (${name}). Search for your city if it's wrong.`
        : null
    );
    setResults(null);
    setQuery("");
    setError(null);
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy("search");
    setError(null);
    try {
      const found = await searchPlaces(query.trim());
      setResults(found);
      if (!found.length) setError("No places match that name.");
    } catch {
      setError("Couldn't search right now. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const locate = async () => {
    setBusy("locate");
    setError(null);
    try {
      const p = await currentPlace();
      choose(p, !!p.approximate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get your location.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex scroll-mt-4 flex-col gap-3 py-2.5" ref={sectionRef}>
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <div className="font-medium text-sm">Weather</div>
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            {place ? (
              <>
                <MapPin className="size-3" />
                <span className="truncate">
                  {place.name}
                  {place.detail ? `, ${place.detail}` : ""}
                </span>
              </>
            ) : (
              "On the welcome screen. Pick a place below."
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ToggleGroup
            multiple={false}
            onValueChange={(d) => d.value[0] && onChange({ tempUnit: d.value[0] as TempUnit })}
            size="sm"
            spacing={1}
            value={[settings.tempUnit]}
            variant="outline"
          >
            <ToggleGroupItem aria-label="Celsius" value="celsius">
              °C
            </ToggleGroupItem>
            <ToggleGroupItem aria-label="Fahrenheit" value="fahrenheit">
              °F
            </ToggleGroupItem>
          </ToggleGroup>
          <Switch
            aria-label="Show weather"
            checked={settings.showWeather}
            onCheckedChange={(d) => onChange({ showWeather: d.checked })}
          />
        </div>
      </div>

      <form className="flex gap-2" onSubmit={search}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-s-2.5 top-2 size-4 text-muted-foreground" />
          <Input
            className="ps-8"
            onChange={(e) => setQuery(e.target.value)}
            ref={inputRef}
            placeholder={place ? "Change city" : "Search for a city"}
            value={query}
          />
        </div>
        <Button disabled={!query.trim()} isLoading={busy === "search"} type="submit" variant="outline">
          Search
        </Button>
        <Button
          aria-label="Use my location"
          isLoading={busy === "locate"}
          onClick={locate}
          title="Use my location"
          variant="outline"
        >
          <LocateFixed />
        </Button>
      </form>

      {error && <p className="text-destructive-foreground text-xs">{error}</p>}
      {note && <p className="text-muted-foreground text-xs">{note}</p>}

      {results && results.length > 0 && (
        <ul className="flex flex-col divide-y border">
          {results.map((r) => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button
                className="flex w-full items-baseline gap-2 px-3 py-2 text-start text-sm hover:bg-accent"
                onClick={() => choose(r)}
                type="button"
              >
                <span className="font-medium">{r.name}</span>
                <span className="truncate text-muted-foreground text-xs">{r.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
