import { useEffect, useState } from "react";
import { fetchProfile, type Profile } from "@/lib/api";
import { readStore, writeStore } from "@/lib/storage";

const TTL = 12 * 60 * 60_000;

// Ties the cache to a token without storing the token a second time.
const fingerprint = (token: string) => token.slice(-8);

/** The profile rarely changes, so it's fetched at most twice a day. */
export const useProfile = (token: string) => {
  const [profile, setProfile] = useState<Profile | null>(() => {
    const cached = readStore<{ token: string; profile: Profile } | null>("profile", null);
    return token && cached?.token === fingerprint(token) ? cached.profile : null;
  });

  useEffect(() => {
    if (!token) {
      setProfile(null);
      return;
    }
    const cached = readStore<{ token: string; profile: Profile; at: number } | null>(
      "profile",
      null
    );
    if (cached?.token === fingerprint(token) && Date.now() - cached.at < TTL) {
      setProfile(cached.profile);
      return;
    }
    let cancelled = false;
    fetchProfile(token)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        writeStore("profile", { token: fingerprint(token), profile: p, at: Date.now() });
      })
      .catch(() => {
        // the feed surfaces auth errors; the profile is decorative
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return profile;
};
