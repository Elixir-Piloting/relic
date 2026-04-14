import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../keys";

interface DbStatusResponse {
  connected: boolean;
}

async function fetchDbStatus(): Promise<DbStatusResponse> {
  const response = await fetch("/api/db/status");
  if (!response.ok) {
    throw new Error("Failed to fetch database status");
  }
  return response.json();
}

export function useDbStatus(connectionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.db.status(connectionId || ""),
    queryFn: fetchDbStatus,
    enabled: !!connectionId,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: true,
  });
}
