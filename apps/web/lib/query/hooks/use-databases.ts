import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../keys";

interface DatabaseResponse {
  databases: string[];
}

export function useDatabases(connectionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.db.database(connectionId || ""),
    queryFn: async (): Promise<string[]> => {
      const response = await fetch("/api/db/database");
      if (!response.ok) {
        const data = await response.json();
        if (
          data.error?.includes("Not connected") ||
          data.error?.includes("No database connection") ||
          data.error?.includes("closed")
        ) {
          return [];
        }
        throw new Error(data.error || "Failed to fetch databases");
      }
      const data: DatabaseResponse = await response.json();
      return data.databases || [];
    },
    enabled: !!connectionId,
    staleTime: 1000 * 60 * 5,
    retry: 3,
    retryDelay: 500,
  });
}