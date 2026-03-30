import type { FwiCurrentResponse } from "./types";

export async function fetchCurrentFwi(): Promise<FwiCurrentResponse> {
  const res = await fetch("/api/fwi/current");
  if (!res.ok) {
    throw new Error(`Failed to load FWI (${res.status})`);
  }
  return (await res.json()) as FwiCurrentResponse;
}

