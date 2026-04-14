import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../keys";

interface LocalPostgresServer {
  host: string;
  port: number;
  version?: string;
  accessible?: boolean;
  databases?: string[];
  expanded?: boolean;
  loadingDatabases?: boolean;
}

interface LocalPgServersResponse {
  servers: LocalPostgresServer[];
}

export function useLocalPgServers() {
  return useQuery({
    queryKey: queryKeys.localPg.servers,
    queryFn: async (): Promise<LocalPostgresServer[]> => {
      const response = await fetch("/api/db/local-postgres/detect");
      if (!response.ok) {
        throw new Error("Failed to detect local PostgreSQL servers");
      }
      const data: LocalPgServersResponse = await response.json();
      return data.servers || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

interface LoadDatabasesVariables {
  host: string;
  port: number;
  user: string;
  password: string;
}

export function useLocalPgDatabases() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["localPg", "databases"],
    mutationFn: async ({ host, port, user, password }: LoadDatabasesVariables): Promise<string[]> => {
      const response = await fetch("/api/db/local-postgres/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, user, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load databases");
      }
      return data.databases || [];
    },
    onSuccess: (_, variables) => {
      const serverKey = `${variables.host}:${variables.port}`;
      queryClient.invalidateQueries({ queryKey: queryKeys.localPg.databases(serverKey) });
    },
  });
}

interface CreateDatabaseVariables {
  host: string;
  port: number;
  user: string;
  password?: string;
  databaseName: string;
}

export function useCreateDatabase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["localPg", "createDatabase"],
    mutationFn: async ({ host, port, user, password, databaseName }: CreateDatabaseVariables) => {
      const response = await fetch("/api/db/local-postgres/create-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, user, password, databaseName }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create database");
      }
      return data;
    },
    onSuccess: (_, variables) => {
      const serverKey = `${variables.host}:${variables.port}`;
      queryClient.invalidateQueries({ queryKey: queryKeys.localPg.databases(serverKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.localPg.servers });
    },
  });
}
