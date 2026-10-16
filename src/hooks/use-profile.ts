import { useEffect, useState } from "react";
import { fetchProfile, type Profile } from "@/lib/api";
import { readStore, writeStore } from "@/lib/storage";

const TTL = 12 * 60 * 60_000;

/** The profile rarely changes, so it's fetched at most twice a day. */
export const useProfile = (enabled: boolean) => {
  const [profile, setProfile] = useState<Profile | null>(
    () => readStore<{ profile: Profile } | null>("profile", null)?.profile ?? null
  );

  useEffect(() => {
    if (!enabled) return;
    const cached = readStore<{ profile: Profile; at: number } | null>("profile", null);
    if (cached && Date.now() - cached.at < TTL) {
      setProfile(cached.profile);
      return;
    }
    let cancelled = false;
    fetchProfile()
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        writeStore("profile", { profile: p, at: Date.now() });
      })
      .catch(() => {
        // the feed surfaces auth errors; the profile is decorative
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return profile;
};
