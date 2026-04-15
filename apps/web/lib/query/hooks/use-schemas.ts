import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../keys";

interface SchemaResponse {
  schemas: string[];
}

export function useSchemas(connectionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.db.schema(connectionId || ""),
    queryFn: async (): Promise<string[]> => {
      const response = await fetch("/api/db/schema");
      if (!response.ok) {
        const data = await response.json();
        if (
          data.error?.includes("Not connected") ||
          data.error?.includes("No database connection") ||
          data.error?.includes("closed")
        ) {
          return [];
        }
        throw new Error(data.error || "Failed to fetch schemas");
      }
      const data: SchemaResponse = await response.json();
      return data.schemas || [];
    },
    enabled: !!connectionId,
    staleTime: 1000 * 60 * 5,
    retry: 3,
    retryDelay: 500,
  });
}
