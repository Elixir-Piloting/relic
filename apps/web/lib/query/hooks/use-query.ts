import { useMutation } from "@tanstack/react-query";
import { queryKeys } from "../keys";
import type { ConnectionConfig, QueryResult } from "@/lib/db/types";

interface ExecuteQueryVariables {
  query: string;
  params?: unknown[];
}

export function useExecuteQuery(connectionId: string | undefined) {
  return useMutation({
    mutationKey: queryKeys.query(connectionId || ""),
    mutationFn: async ({ query, params }: ExecuteQueryVariables): Promise<{ success: boolean; data?: QueryResult; error?: string }> => {
      const response = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, params }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Query execution failed");
      }
      return data;
    },
  });
}
