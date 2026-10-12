import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  type LucideIcon,
  Moon,
  Sun,
} from "lucide-react";

// Open-Meteo: free, no API key, and it allows cross-origin requests,
// so no host permission is needed. https://open-meteo.com

export interface WeatherPlace {
  name: string;
  /** Region and country, for telling same-named places apart. */
  detail: string;
  latitude: number;
  longitude: number;
}

export type TempUnit = "celsius" | "fahrenheit";

export interface Weather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  code: number;
  isDay: boolean;
  days: { date: string; code: number; max: number; min: number }[];
  fetchedAt: number;
}

export const searchPlaces = async (query: string): Promise<WeatherPlace[]> => {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[];
  };
  return (data.results ?? []).map((r) => ({
    name: r.name,
    detail: [r.admin1, r.country].filter(Boolean).join(", "),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
};

export const fetchWeather = async (place: WeatherPlace, unit: TempUnit): Promise<Weather> => {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current:
      "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "4",
    temperature_unit: unit,
    wind_speed_unit: unit === "fahrenheit" ? "mph" : "kmh",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  return {
    temperature: d.current.temperature_2m,
    feelsLike: d.current.apparent_temperature,
    humidity: d.current.relative_humidity_2m,
    wind: d.current.wind_speed_10m,
    code: d.current.weather_code,
    isDay: d.current.is_day === 1,
    days: (d.daily.time as string[]).map((date, i) => ({
      date,
      code: d.daily.weather_code[i],
      max: d.daily.temperature_2m_max[i],
      min: d.daily.temperature_2m_min[i],
    })),
    fetchedAt: Date.now(),
  };
};

const browserPosition = () =>
  new Promise<WeatherPlace>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          name: "Current location",
          detail: `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      reject,
      { maximumAge: 60 * 60_000, timeout: 8_000 }
    );
  });

// Approximate city from the IP address. Only used after the user clicks
// "Use my location" and the browser can't provide a position.
const IP_SERVICES: { url: string; parse: (d: Record<string, unknown>) => WeatherPlace | null }[] = [
  {
    url: "https://get.geojs.io/v1/ip/geo.json",
    parse: (d) =>
      d.latitude && d.longitude
        ? {
            name: String(d.city || d.region || "Your area"),
            detail: [d.region, d.country].filter(Boolean).join(", "),
            latitude: Number(d.latitude),
            longitude: Number(d.longitude),
          }
        : null,
  },
  {
    url: "https://ipwho.is/",
    parse: (d) =>
      d.success !== false && d.latitude && d.longitude
        ? {
            name: String(d.city || d.region || "Your area"),
            detail: [d.region, d.country].filter(Boolean).join(", "),
            latitude: Number(d.latitude),
            longitude: Number(d.longitude),
          }
        : null,
  },
];

const ipPlace = async (): Promise<WeatherPlace> => {
  for (const service of IP_SERVICES) {
    try {
      const res = await fetch(service.url, { credentials: "omit" });
      if (!res.ok) continue;
      const place = service.parse(await res.json());
      if (place) return place;
    } catch {
      // try the next service
    }
  }
  throw new Error("none");
};

/**
 * The browser's position when it can give one. Brave turns off Google's
 * location service by default, so geolocation often fails there; we then fall
 * back to an approximate city from the IP address.
 */
export const currentPlace = async (): Promise<WeatherPlace & { approximate?: boolean }> => {
  try {
    return await browserPosition();
  } catch {
    try {
      return { ...(await ipPlace()), approximate: true };
    } catch {
      throw new Error("Couldn't find your location. Search for your city instead.");
    }
  }
};

// WMO weather interpretation codes, as used by Open-Meteo.
export const describeWeather = (code: number, isDay = true): { label: string; icon: LucideIcon } => {
  if (code === 0) return { label: "Clear", icon: isDay ? Sun : Moon };
  if (code <= 2) return { label: code === 1 ? "Mostly clear" : "Partly cloudy", icon: isDay ? CloudSun : CloudMoon };
  if (code === 3) return { label: "Overcast", icon: Cloud };
  if (code === 45 || code === 48) return { label: "Fog", icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: CloudDrizzle };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return { label: code >= 80 ? "Showers" : "Rain", icon: CloudRain };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", icon: CloudSnow };
  if (code >= 95) return { label: "Thunderstorm", icon: CloudLightning };
  return { label: "Cloudy", icon: Cloud };
};
