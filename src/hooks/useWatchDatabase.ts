import { useEffect, useState } from "react";
import type { Watch } from "@/types";

export type WatchDatabaseStatus = "loading" | "ready" | "error";

interface WatchDatabaseState {
  watches: Watch[];
  status: WatchDatabaseStatus;
  retry: () => void;
}

export function useWatchDatabase(providedWatches?: Watch[], refreshProvided = false): WatchDatabaseState {
  const [fetchedWatches, setFetchedWatches] = useState<Watch[] | null>(providedWatches ?? null);
  const [status, setStatus] = useState<WatchDatabaseStatus>(
    providedWatches && !refreshProvided ? "ready" : "loading"
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (providedWatches && !refreshProvided) return;

    let cancelled = false;
    setStatus("loading");
    fetch("/api/watches.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
        return response.json() as Promise<{ watches: Watch[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setFetchedWatches(data.watches);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, providedWatches, refreshProvided]);

  return {
    watches: fetchedWatches ?? providedWatches ?? [],
    status: providedWatches && !refreshProvided ? "ready" : status,
    retry: () => setAttempt((current) => current + 1)
  };
}
