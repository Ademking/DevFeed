import { useCallback, useEffect, useRef } from "react";
import { checkConnection } from "@/lib/api";
import { readStore, useStored, writeStore } from "@/lib/storage";

// Re-verifying the daily.dev session hits the network, so don't do it more
// often than this when tabs are opened in quick succession.
const MIN_INTERVAL_MS = 30_000;

export type ConnectionStatus = "checking" | "connected" | "disconnected";

/**
 * Whether the browser has a usable daily.dev session. daily.dev's own cookies
 * are the only credential; there is no token to manage.
 */
export const useAuth = () => {
  const [connected, setConnected] = useStored<boolean | null>("connected", null);
  const checking = useRef(false);
  const checkedAt = useRef(readStore("connectedAt", 0));

  const recheck = useCallback(
    async (force = false) => {
      if (checking.current) return;
      if (!force && Date.now() - checkedAt.current < MIN_INTERVAL_MS) return;
      checking.current = true;
      try {
        setConnected(await checkConnection());
      } catch {
        // A network failure isn't proof the session is gone; keep the last
        // known state and let the feed surface the real error.
      } finally {
        checkedAt.current = Date.now();
        writeStore("connectedAt", checkedAt.current);
        checking.current = false;
      }
    },
    [setConnected]
  );

  // Verify on open, and again when a tab is focused, so signing in or out on
  // daily.dev shows up without a reload.
  useEffect(() => {
    recheck();
    const onVisible = () => {
      if (document.visibilityState === "visible") recheck();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [recheck]);

  const status: ConnectionStatus =
    connected === null ? "checking" : connected ? "connected" : "disconnected";

  return { status, recheck };
};
