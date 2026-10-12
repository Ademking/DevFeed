import { useEffect, useState } from "react";
import { idbGet } from "@/lib/idb";
import type { Settings } from "@/lib/storage";

export const BACKGROUND_KEY = "background-image";

/** Resolves the background setting to something an <img>/CSS url() can use. */
export const useBackgroundSrc = (bg: Settings["background"]) => {
  const [src, setSrc] = useState<string | null>(bg.kind === "url" ? bg.url : null);

  useEffect(() => {
    if (bg.kind === "url") {
      setSrc(bg.url);
      return;
    }
    if (bg.kind !== "upload") {
      setSrc(null);
      return;
    }
    // Uploads live in IndexedDB as a Blob; give the page a temporary object URL.
    let url: string | null = null;
    let cancelled = false;
    idbGet<Blob>(BACKGROUND_KEY).then((blob) => {
      if (cancelled || !blob) return;
      url = URL.createObjectURL(blob);
      setSrc(url);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // updatedAt changes on every new upload
  }, [bg.kind, bg.kind === "url" ? bg.url : bg.kind === "upload" ? bg.updatedAt : 0]);

  return src;
};
