import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../keys";
import type { TableInfo } from "@/lib/db/types";

interface TablesResponse {
  tables: TableInfo[];
}

export function useTables(connectionId: string | undefined, schema: string | undefined) {
  return useQuery({
    queryKey: queryKeys.db.tables(connectionId || "", schema || ""),
    queryFn: async (): Promise<TableInfo[]> => {
      if (!schema) return [];
      const response = await fetch(`/api/db/schema?schema=${encodeURIComponent(schema)}`);
      if (!response.ok) {
        const data = await response.json();
        if (data.error?.includes("Not connected") || data.error?.includes("No database connection")) {
          return [];
        }
        throw new Error(data.error || "Failed to fetch tables");
      }
      const data: TablesResponse = await response.json();
      return data.tables || [];
    },
    enabled: !!connectionId && !!schema,
    staleTime: 1000 * 60 * 5,
    retry: 3,
    retryDelay: 500,
  });
}
