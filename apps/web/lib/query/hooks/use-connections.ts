import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../keys";
import { getAllConnections, saveConnection as dbSaveConnection, deleteConnection as dbDeleteConnection, type SavedConnection } from "@/lib/db/indexeddb";
import type { ConnectionConfig } from "@/lib/db/types";

export function useConnections() {
  return useQuery({
    queryKey: queryKeys.connections.all,
    queryFn: getAllConnections,
  });
}

interface SaveConnectionVariables {
  connection: SavedConnection;
}

export function useSaveConnection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ connection }: SaveConnectionVariables) => {
      await dbSaveConnection(connection);
      return connection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.all });
    },
  });
}

interface DeleteConnectionVariables {
  id: string;
}

export function useDeleteConnection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id }: DeleteConnectionVariables) => {
      await dbDeleteConnection(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.all });
    },
  });
}

interface TestConnectionVariables {
  config: ConnectionConfig;
}

export function useTestConnection() {
  return useMutation({
    mutationKey: ["connections", "test"],
    mutationFn: async ({ config }: TestConnectionVariables) => {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", ...config }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to test connection");
      }
      return data;
    },
  });
}
