import { useEffect, useState } from "react";
import { readStore, writeStore } from "@/lib/storage";
import { fetchWeather, type TempUnit, type Weather, type WeatherPlace } from "@/lib/weather";

const STALE_MS = 30 * 60_000;

type Cached = Weather & { key: string };

/** Current weather for a place, cached for 30 minutes across new tabs. */
export const useWeather = (place: WeatherPlace | null, unit: TempUnit, enabled: boolean) => {
  const key = place ? `${place.latitude},${place.longitude},${unit}` : "";
  const [weather, setWeather] = useState<Weather | null>(() => {
    const cached = readStore<Cached | null>("weather", null);
    return cached && cached.key === key ? cached : null;
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !place) return;
    const cached = readStore<Cached | null>("weather", null);
    if (cached?.key === key) {
      setWeather(cached);
      if (Date.now() - cached.fetchedAt < STALE_MS) return;
    } else {
      setWeather(null);
    }
    let cancelled = false;
    fetchWeather(place, unit)
      .then((w) => {
        if (cancelled) return;
        setWeather(w);
        setError(null);
        writeStore("weather", { ...w, key });
      })
      .catch(() => !cancelled && setError("Weather is unavailable right now."));
    return () => {
      cancelled = true;
    };
    // key covers place and unit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { weather, error };
};
