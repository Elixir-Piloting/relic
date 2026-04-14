"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { Schema, Table } from "./types";

export function useSchemaLoader(connectionId: string | undefined) {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMongoDB, setIsMongoDB] = useState(false);
  const [isRefreshingTables, setIsRefreshingTables] = useState(false);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/db/status");
      const data = await response.json();
      return data.connected === true;
    } catch {
      return false;
    }
  }, []);

  const loadSchemas = useCallback(async (retryCount = 0) => {
    setIsLoading(true);
    try {
      if (retryCount === 0) {
        const isConnected = await checkConnection();
        if (!isConnected && connectionId) {
          const { getConnection } = await import("@/lib/connections/store");
          const conn = getConnection(connectionId);
          if (conn) {
            try {
              await fetch("/api/db/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(conn),
              });
              await new Promise((resolve) => setTimeout(resolve, 300));
            } catch (reconnectError) {
              console.error("Failed to reconnect:", reconnectError);
            }
          }

          if (retryCount < 5) {
            setTimeout(() => loadSchemas(retryCount + 1), 500);
            return;
          }
        }
      }

      const response = await fetch("/api/db/schema");
      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || "Failed to load schemas";
        if (
          errorMsg.includes("Not connected") ||
          errorMsg.includes("No database connection") ||
          errorMsg.includes("closed") ||
          errorMsg.includes("not queryable")
        ) {
          if (retryCount < 5) {
            setTimeout(() => loadSchemas(retryCount + 1), 500);
            return;
          }
          setSchemas([]);
          return;
        }
        throw new Error(errorMsg);
      }

      if (data.error) {
        const errorMsg = data.error;
        if (
          retryCount < 5 &&
          (errorMsg.includes("connection") ||
            errorMsg.includes("closed") ||
            errorMsg.includes("not queryable") ||
            errorMsg.includes("Connection terminated") ||
            errorMsg.includes("terminated"))
        ) {
          setTimeout(() => loadSchemas(retryCount + 1), 500);
          return;
        }
        setSchemas([]);
        return;
      }

      const schemasList = data.schemas || [];
      if (schemasList.length === 0 && retryCount < 3) {
        setTimeout(() => loadSchemas(retryCount + 1), 500);
        return;
      }

      setSchemas((prevSchemas) => {
        const existingTablesMap = new Map(prevSchemas.map((s) => [s.name, s.tables]));

        const sortedSchemasList = [...schemasList].sort((a, b) => {
          if (a === "public") return -1;
          if (b === "public") return 1;
          return a.localeCompare(b);
        });

        const newSchemas = sortedSchemasList.map((name: string) => ({
          name,
          tables: existingTablesMap.get(name),
        }));

        if (newSchemas.length > 0) {
          const schemaToLoad = selectedSchema && sortedSchemasList.includes(selectedSchema)
            ? selectedSchema
            : newSchemas[0].name;

          const targetSchema = newSchemas.find((s) => s.name === schemaToLoad);
          if (targetSchema && !targetSchema.tables) {
            setTimeout(() => loadTables(schemaToLoad), 0);
          }
        }

        return newSchemas;
      });
    } catch (error) {
      console.error("Failed to load schemas:", error);
      if (retryCount < 3) {
        setTimeout(() => loadSchemas(retryCount + 1), 500);
        return;
      }
      setSchemas([]);
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, selectedSchema, checkConnection]);

  const loadTables = useCallback(async (schemaName: string, showLoading = false) => {
    if (showLoading) {
      setIsRefreshingTables(true);
    }
    try {
      const response = await fetch(`/api/db/schema?schema=${encodeURIComponent(schemaName)}`);
      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes("Not connected") || data.error?.includes("No database connection")) {
          return;
        }
        throw new Error(data.error || "Failed to load tables");
      }

      if (data.error) {
        return;
      }

      setSchemas((prev) =>
        prev.map((s) =>
          s.name === schemaName ? { ...s, tables: data.tables || [] } : s
        )
      );
    } catch (error) {
      console.error("Failed to load tables:", error);
    } finally {
      if (showLoading) {
        setIsRefreshingTables(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!connectionId) {
      setSchemas([]);
      setIsLoading(false);
      setSelectedSchema(null);
      setIsMongoDB(false);
      return;
    }

    const conn = getConnection(connectionId);
    setIsMongoDB(conn?.provider === "mongodb");

    setIsLoading(true);
    const timer = setTimeout(() => {
      loadSchemas();
    }, 300);

    return () => clearTimeout(timer);
  }, [connectionId, loadSchemas]);

  useEffect(() => {
    if (schemas.length > 0 && !selectedSchema) {
      const firstSchema = schemas[0].name;
      setSelectedSchema(firstSchema);
      const firstSchemaObj = schemas.find((s) => s.name === firstSchema);
      if (firstSchemaObj && !firstSchemaObj.tables) {
        loadTables(firstSchema).catch(console.error);
      }
    }
  }, [schemas.length]);

  return {
    schemas,
    selectedSchema,
    setSelectedSchema,
    isLoading,
    isMongoDB,
    isRefreshingTables,
    loadSchemas,
    loadTables,
  };
}

function getConnection(id: string) {
  return { id, provider: "postgresql", name: "test" };
}