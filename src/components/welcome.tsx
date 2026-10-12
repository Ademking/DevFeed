import { Droplets, MapPin, Wind } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { useNow } from "@/hooks/use-now";
import { useWeather } from "@/hooks/use-weather";
import { greeting } from "@/lib/format";
import { SHORTCUTS } from "@/lib/shortcuts";
import { describeWeather, type TempUnit, type WeatherPlace } from "@/lib/weather";

const deg = (n: number) => `${Math.round(n)}°`;

const WELCOME_SHORTCUTS = [
  "Command menu: search the web, jump anywhere",
  "Next post",
  "Previous post",
  "Open article",
  "Show only unread posts",
];

const Clock = ({ now }: { now: Date }) => {
  const parts = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).formatToParts(now);
  const time = parts
    .filter((p) => p.type !== "dayPeriod")
    .map((p) => p.value)
    .join("")
    .trim();
  const period = parts.find((p) => p.type === "dayPeriod")?.value;
  return (
    <div className="flex items-start font-heading font-semibold leading-none tabular-nums">
      {/* Sized by the smaller of width and height, so short laptop screens get a smaller clock. */}
      <span className="text-[clamp(44px,min(6vw,10vh),96px)] tracking-tight">{time}</span>
      {period && (
        <span className="ms-1.5 mt-1 text-[clamp(13px,1.8vh,20px)] text-muted-foreground">
          {period}
        </span>
      )}
    </div>
  );
};

const WeatherCard = ({
  place,
  unit,
  onSetup,
}: {
  place: WeatherPlace | null;
  unit: TempUnit;
  onSetup: () => void;
}) => {
  const { weather, error } = useWeather(place, unit, true);

  if (!place) {
    return (
      <button
        className="flex items-center gap-2 border border-dashed px-4 py-2.5 text-muted-foreground text-sm transition-colors hover:border-foreground/40 hover:text-foreground"
        onClick={onSetup}
        type="button"
      >
        <MapPin className="size-4" />
        Add your city to see the weather
      </button>
    );
  }
  if (!weather) {
    return (
      <div className="h-[132px] w-full max-w-md border px-5 py-4 text-muted-foreground text-sm">
        {error ?? "Loading weather…"}
      </div>
    );
  }

  const now = describeWeather(weather.code, weather.isDay);
  const Icon = now.icon;
  const today = weather.days[0];
  const speedUnit = unit === "fahrenheit" ? "mph" : "km/h";

  return (
    <div className="flex w-full max-w-md flex-col border">
      <div className="flex items-center gap-4 px-5 py-4">
        <Icon className="size-11 shrink-0" strokeWidth={1.5} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-semibold text-4xl tabular-nums">
              {deg(weather.temperature)}
            </span>
            <span className="truncate text-sm">{now.label}</span>
          </div>
          <button
            className="flex w-fit items-center gap-1 truncate text-muted-foreground text-xs hover:text-foreground"
            onClick={onSetup}
            title="Change location"
            type="button"
          >
            <MapPin className="size-3" />
            {place.name}
          </button>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-muted-foreground text-xs tabular-nums">
          {today && (
            <span>
              H {deg(today.max)} · L {deg(today.min)}
            </span>
          )}
          <span>Feels {deg(weather.feelsLike)}</span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              <Droplets className="size-3" />
              {weather.humidity}%
            </span>
            <span className="flex items-center gap-0.5">
              <Wind className="size-3" />
              {Math.round(weather.wind)} {speedUnit}
            </span>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x border-t">
        {weather.days.slice(1, 4).map((d) => {
          const day = describeWeather(d.code);
          const DayIcon = day.icon;
          return (
            <div className="flex flex-col items-center gap-1 py-2.5" key={d.date} title={day.label}>
              <span className="text-muted-foreground text-xs">
                {new Date(`${d.date}T12:00`).toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <DayIcon className="size-5" strokeWidth={1.5} />
              <span className="text-xs tabular-nums">
                {deg(d.max)} <span className="text-muted-foreground">{deg(d.min)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface WelcomeProps {
  name?: string;
  showClock: boolean;
  showWeather: boolean;
  place: WeatherPlace | null;
  unit: TempUnit;
  onSetupWeather: () => void;
}

/** What the reading pane shows until a post is picked. */
export const Welcome = ({ name, showClock, showWeather, place, unit, onSetupWeather }: WelcomeProps) => {
  const now = useNow();
  return (
    // Spacing tightens on short windows so everything fits without scrolling.
    <div className="flex h-full flex-col items-center justify-center gap-[clamp(16px,4vh,32px)] overflow-y-auto p-6 text-center">
      <div className="flex flex-col items-center gap-[clamp(4px,1.2vh,12px)]">
        {showClock && <Clock now={now} />}
        <p className="font-heading font-semibold text-[clamp(18px,2.6vh,24px)]">
          {greeting(now)}
          {name ? `, ${name}` : ""}
        </p>
        <p className="text-muted-foreground text-sm">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {showWeather && <WeatherCard onSetup={onSetupWeather} place={place} unit={unit} />}

      {/* The essentials only; "?" lists everything. Hidden when the window is short. */}
      <div className="flex flex-col items-center gap-3 [@media(max-height:720px)]:hidden">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          {SHORTCUTS.filter((s) => WELCOME_SHORTCUTS.includes(s.label)).map(({ keys, label }) => (
            <div className="contents" key={label}>
              <dt className="flex justify-end gap-1">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </dt>
              <dd className="text-start text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground/70 text-xs">
          Press <Kbd>?</Kbd> for all shortcuts
        </p>
      </div>
    </div>
  );
};
