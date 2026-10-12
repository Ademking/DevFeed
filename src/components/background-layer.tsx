import { useState } from "react";
import { useBackgroundSrc } from "@/hooks/use-background";
import type { Settings } from "@/lib/storage";

/** A faint full-screen image behind the app. Content stays readable on top. */
export const BackgroundLayer = ({ settings }: { settings: Settings }) => {
  const src = useBackgroundSrc(settings.background);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  if (!src) return null;
  return (
    <img
      alt=""
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 size-full select-none object-cover transition-opacity duration-500"
      onLoad={() => setLoadedSrc(src)}
      referrerPolicy="no-referrer"
      src={src}
      style={{
        // Fade in once loaded instead of popping in at full strength.
        opacity: loadedSrc === src ? settings.bgOpacity : 0,
        filter: settings.bgBlur ? `blur(${settings.bgBlur}px)` : undefined,
        // Blur pulls in transparent edges; scaling up a little hides them.
        transform: settings.bgBlur ? "scale(1.05)" : undefined,
      }}
    />
  );
};
