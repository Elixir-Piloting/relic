"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { ResultsViewer } from "@/components/results-viewer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Loader2 } from "lucide-react";
import { getConnection } from "@/lib/connections/store";
import { Persistence } from "@/lib/persistence";
import type { ConnectionConfig } from "@/lib/db/types";
import type { ColumnInfo, IndexInfo, ConstraintInfo } from "@/lib/db/types";
import { DatabaseProvider } from "@/lib/db/providers";
import { cn } from "@/lib/utils";

interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: Array<{ name: string; dataTypeID: number }>;
}

export default function TablePage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.connection as string;
  const tablePath = params.table as string;
  const [schema, table] = tablePath.split(".");
  
  const [connection, setConnection] = useState<ConnectionConfig | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [constraints, setConstraints] = useState<ConstraintInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 100;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const conn = getConnection(connectionId);
      if (conn) {
        setConnection(conn);
        // Auto-connect
        fetch("/api/db/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(conn),
        }).then(() => {
          loadTableData();
          loadTableInfo();
        }).catch(console.error);
      }
    }
  }, [connectionId, schema, table]);

  const loadTableData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get connection if not already loaded
      const conn = connection || getConnection(connectionId);
      if (!conn) {
        throw new Error("Connection not found");
      }

      const offset = (page - 1) * limit;
      // Use query builder for provider-aware queries
      const { buildTableQuery } = await import("@/lib/db/query-builder");
      const { query, params } = buildTableQuery(schema, table, limit, offset, conn.provider);
      
      console.log("[TablePage] Loading table data:", { schema, table, provider: conn.provider, query });
      
      const response = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, params }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        const errorMsg = data.error || "Failed to load table data";
        setError(errorMsg);
        // Don't show toast for connection errors - they're handled in the UI
        if (!errorMsg.includes("No database connection") && !errorMsg.includes("Please connect first")) {
          toast.error("Failed to load table data", {
            description: errorMsg,
          });
        }
        return;
      }

      setResult(data.data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load table data";
      setError(errorMsg);
      // Don't show toast for connection errors - they're handled in the UI
      if (!errorMsg.includes("No database connection") && !errorMsg.includes("Please connect first")) {
        toast.error("Failed to load table data", {
          description: errorMsg,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTableInfo = async () => {
    try {
      // Get connection if not already loaded
      const conn = connection || getConnection(connectionId);
      if (!conn) {
        console.warn("[TablePage] Connection not found for loadTableInfo");
        return;
      }

      // Skip table info loading for MongoDB (no schemas/columns/indexes)
      if (conn.provider === DatabaseProvider.MONGODB) {
        setColumns([]);
        setIndexes([]);
        setConstraints([]);
        return;
      }

      // Load columns
      const columnsQuery = `SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position`;

      const columnsResponse = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: columnsQuery, params: [schema, table] }),
      });

      const columnsData = await columnsResponse.json();
      if (columnsData.success) {
        setColumns(
          columnsData.data.rows.map((r: any) => ({
            name: r.column_name,
            dataType: r.data_type,
            isNullable: r.is_nullable === "YES",
            defaultValue: r.column_default,
            characterMaximumLength: r.character_maximum_length,
          }))
        );
      }

      // Load indexes
      const indexesQuery = `SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = $1 AND tablename = $2
      ORDER BY indexname`;

      const indexesResponse = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: indexesQuery, params: [schema, table] }),
      });

      const indexesData = await indexesResponse.json();
      if (indexesData.success) {
        setIndexes(
          indexesData.data.rows.map((r: any) => {
            const isUnique = r.indexdef.includes("UNIQUE");
            const isPrimary = r.indexname.includes("_pkey");
            const match = r.indexdef.match(/\(([^)]+)\)/);
            const columns = match
              ? match[1].split(",").map((c: string) => c.trim().replace(/"/g, ""))
              : [];
            return {
              name: r.indexname,
              columns,
              isUnique,
              isPrimary,
            };
          })
        );
      }

      // Load constraints
      const constraintsQuery = `SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = $1 
        AND tc.table_name = $2
      ORDER BY tc.constraint_name, kcu.ordinal_position`;

      const constraintsResponse = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: constraintsQuery, params: [schema, table] }),
      });

      const constraintsData = await constraintsResponse.json();
      if (constraintsData.success) {
        const constraintsMap = new Map<string, ConstraintInfo>();
        for (const row of constraintsData.data.rows) {
          const existing = constraintsMap.get(row.constraint_name);
          if (existing) {
            existing.columns.push(row.column_name);
          } else {
            constraintsMap.set(row.constraint_name, {
              name: row.constraint_name,
              type: row.constraint_type as ConstraintInfo["type"],
              columns: [row.column_name],
            });
          }
        }
        setConstraints(Array.from(constraintsMap.values()));
      }
    } catch (err) {
      console.error("Failed to load table info:", err);
    }
  };

  useEffect(() => {
    if (connection) {
      loadTableData();
    }
  }, [page, connection]);

  // Redirect to connections page if connection not found (only after checking store)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!connectionId) return;
    
    // Check if connection exists in store - if it does, never redirect
    const conn = getConnection(connectionId);
    if (conn) {
      return; // Connection exists in store, let loading handle it
    }
    
    // Connection doesn't exist in store - redirect immediately
    // (No need to wait, if it's not in the store, it doesn't exist)
    const activeConnectionId = Persistence.getActiveConnectionId();
    if (activeConnectionId === connectionId) {
      Persistence.setActiveConnectionId(null);
    }
    router.push("/connections");
  }, [connectionId, router]); // Remove 'connection' from deps to avoid re-running when connection loads

  if (!connection) {
    return null; // Will redirect
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0">
          <div>
            <h1 className="font-semibold">{table}</h1>
            <p className="text-xs text-muted-foreground">{schema}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadTableData}
            disabled={loading}
            className={cn(
              loading && "text-muted-foreground opacity-50"
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="data" className="h-full flex flex-col">
            <TabsList className="mx-4 mt-4 justify-start">
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="columns">Columns</TabsTrigger>
              <TabsTrigger value="indexes">Indexes</TabsTrigger>
              <TabsTrigger value="constraints">Constraints</TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="flex-1 mt-4 overflow-hidden">
              <ResultsViewer
                result={result}
                error={error}
                loading={loading}
                schema={schema}
                table={table}
                columns={columns}
                primaryKeys={
                  connection?.provider === DatabaseProvider.MONGODB
                    ? ["_id"]
                    : constraints
                        .filter((c) => c.type === "PRIMARY KEY")
                        .flatMap((c) => c.columns)
                }
                onRefresh={loadTableData}
                enableCRUD={true}
                provider={connection?.provider}
              />
            </TabsContent>

            <TabsContent value="columns" className="flex-1 mt-4 overflow-auto">
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Nullable</TableHead>
                      <TableHead>Default</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columns.map((col) => (
                      <TableRow key={col.name}>
                        <TableCell className="font-mono">{col.name}</TableCell>
                        <TableCell>
                          {col.dataType}
                          {col.characterMaximumLength && (
                            <span className="text-muted-foreground">
                              ({col.characterMaximumLength})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{col.isNullable ? "YES" : "NO"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {col.defaultValue || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="indexes" className="flex-1 mt-4 overflow-auto">
              <div className="p-4">
                {indexes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No indexes</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Columns</TableHead>
                        <TableHead>Unique</TableHead>
                        <TableHead>Primary</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {indexes.map((idx) => (
                        <TableRow key={idx.name}>
                          <TableCell className="font-mono">{idx.name}</TableCell>
                          <TableCell>{idx.columns.join(", ")}</TableCell>
                          <TableCell>{idx.isUnique ? "Yes" : "No"}</TableCell>
                          <TableCell>{idx.isPrimary ? "Yes" : "No"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            <TabsContent value="constraints" className="flex-1 mt-4 overflow-auto">
              <div className="p-4">
                {constraints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No constraints</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Columns</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {constraints.map((constraint) => (
                        <TableRow key={constraint.name}>
                          <TableCell className="font-mono">
                            {constraint.name}
                          </TableCell>
                          <TableCell>{constraint.type}</TableCell>
                          <TableCell>{constraint.columns.join(", ")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
