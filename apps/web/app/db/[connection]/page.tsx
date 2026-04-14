"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { DatabaseNavbar } from "@/components/database-navbar";
import { TableTabs, type TableTab } from "@/components/table-tabs";
import { CreateTableDialog } from "@/components/create-table-dialog";
import { ResultsViewer } from "@/components/results-viewer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, X, Loader2 } from "lucide-react";
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

export default function DatabasePage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.connection as string;
  
  const [connection, setConnection] = useState<ConnectionConfig | null>(null);
  const [tableTabs, setTableTabs] = useState<TableTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const initializedRef = useRef<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Persist tabs whenever they change
  useEffect(() => {
    if (connectionId && tableTabs.length >= 0) {
      Persistence.setTableTabs(connectionId, tableTabs);
    }
  }, [connectionId, tableTabs]);

  // Persist active tab whenever it changes
  useEffect(() => {
    if (connectionId && activeTabId) {
      Persistence.setActiveTabId(connectionId, activeTabId);
    }
  }, [connectionId, activeTabId]);
  const [tableData, setTableData] = useState<Map<string, {
    result: QueryResult | null;
    columns: ColumnInfo[];
    indexes: IndexInfo[];
    constraints: ConstraintInfo[];
    loading: boolean;
    error: string | null;
  }>>(new Map());

  const loadTableData = useCallback(async (schema: string, table: string, tabId: string) => {
    setTableData((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(tabId) || {
        result: null,
        columns: [],
        indexes: [],
        constraints: [],
        loading: true,
        error: null,
      };
      newMap.set(tabId, { ...existing, loading: true, error: null });
      return newMap;
    });

    try {
      // Get connection if not already loaded
      const conn = connection || getConnection(connectionId);
      if (!conn) {
        throw new Error("Connection not found");
      }

      // Use query builder for provider-aware queries
      const { buildTableQuery } = await import("@/lib/db/query-builder");
      const { query, params } = buildTableQuery(schema, table, 1000, 0, conn.provider);
      
      console.log("[DatabasePage] Loading table data:", { schema, table, provider: conn.provider, query });
      
      const response = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, params }),
      });

      const data = await response.json();
      setTableData((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(tabId) || {
          result: null,
          columns: [],
          indexes: [],
          constraints: [],
          loading: false,
          error: null,
        };
        if (data.success) {
          newMap.set(tabId, { ...existing, result: data.data, loading: false });
        } else {
          const errorMsg = data.error || "Failed to load table";
          newMap.set(tabId, { ...existing, error: errorMsg, loading: false });
        }
        return newMap;
      });
    } catch (err) {
      setTableData((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(tabId) || {
          result: null,
          columns: [],
          indexes: [],
          constraints: [],
          loading: false,
          error: null,
        };
        newMap.set(tabId, {
          ...existing,
          error: err instanceof Error ? err.message : "Failed to load table",
          loading: false,
        });
        return newMap;
      });
    }
  }, [connection, connectionId]);

  const loadTableInfo = useCallback(async (schema: string, table: string, tabId: string) => {
    try {
      // Get connection if not already loaded
      const conn = connection || getConnection(connectionId);
      if (!conn) {
        console.warn("[DatabasePage] Connection not found for loadTableInfo");
        return;
      }

      // Skip table info loading for MongoDB (no schemas/columns/indexes)
      if (conn.provider === DatabaseProvider.MONGODB) {
        setTableData((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(tabId) || {
            result: null,
            columns: [],
            indexes: [],
            constraints: [],
            loading: false,
            error: null,
          };
          newMap.set(tabId, {
            ...existing,
            columns: [],
            indexes: [],
            constraints: [],
          });
          return newMap;
        });
        return;
      }

      const [columnsRes, indexesRes, constraintsRes] = await Promise.all([
        fetch("/api/db/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
                    FROM information_schema.columns
                    WHERE table_schema = $1 AND table_name = $2
                    ORDER BY ordinal_position`,
            params: [schema, table],
          }),
        }),
        fetch("/api/db/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `SELECT indexname, indexdef FROM pg_indexes
                    WHERE schemaname = $1 AND tablename = $2
                    ORDER BY indexname`,
            params: [schema, table],
          }),
        }),
        fetch("/api/db/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    WHERE tc.table_schema = $1 AND tc.table_name = $2
                    ORDER BY tc.constraint_name, kcu.ordinal_position`,
            params: [schema, table],
          }),
        }),
      ]);

      const [columnsData, indexesData, constraintsData] = await Promise.all([
        columnsRes.json(),
        indexesRes.json(),
        constraintsRes.json(),
      ]);

      setTableData((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(tabId) || {
          result: null,
          columns: [],
          indexes: [],
          constraints: [],
          loading: false,
          error: null,
        };

        const columns = columnsData.success
          ? columnsData.data.rows.map((r: any) => ({
              name: r.column_name,
              dataType: r.data_type,
              isNullable: r.is_nullable === "YES",
              defaultValue: r.column_default,
              characterMaximumLength: r.character_maximum_length,
            }))
          : [];

        const indexes = indexesData.success
          ? indexesData.data.rows.map((r: any) => {
              const isUnique = r.indexdef.includes("UNIQUE");
              const isPrimary = r.indexname.includes("_pkey");
              const match = r.indexdef.match(/\(([^)]+)\)/);
              const cols = match
                ? match[1].split(",").map((c: string) => c.trim().replace(/"/g, ""))
                : [];
              return { name: r.indexname, columns: cols, isUnique, isPrimary };
            })
          : [];

        const constraintsMap = new Map<string, ConstraintInfo>();
        if (constraintsData.success) {
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
        }

        newMap.set(tabId, {
          ...existing,
          columns,
          indexes,
          constraints: Array.from(constraintsMap.values()),
        });
        return newMap;
      });
    } catch (err) {
      console.error("Failed to load table info:", err);
    }
  }, [connection, connectionId]);

  const openTable = useCallback((schema: string, table: string) => {
    const tabId = `${schema}.${table}`;
    console.log("[DatabasePage] openTable called:", schema, table, "tabId:", tabId);
    
    setTableTabs((prevTabs) => {
      const existingTab = prevTabs.find((t) => t.id === tabId);
      
      // If tab already exists, just switch to it (don't open duplicate)
      if (existingTab) {
        console.log("[DatabasePage] Tab already exists, switching to it");
        setActiveTabId(tabId);
        if (connectionId) {
          Persistence.setActiveTabId(connectionId, tabId);
        }
        return prevTabs;
      }
      
      // Create new tab
      console.log("[DatabasePage] Creating new tab, current tabs:", prevTabs.length);
      const newTab: TableTab = {
        id: tabId,
        schema,
        table,
        label: `${schema}.${table}`,
      };
      const updatedTabs = [...prevTabs, newTab];
      setActiveTabId(tabId);
      
      // Load data for the new tab
      loadTableData(schema, table, tabId);
      loadTableInfo(schema, table, tabId);
      
      return updatedTabs;
    });
  }, [connectionId, loadTableData, loadTableInfo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Prevent re-initialization if we've already initialized for this connection
    if (initializedRef.current === connectionId) return;
    
    const conn = getConnection(connectionId);
    if (!conn) return;

    initializedRef.current = connectionId;
    setConnection(conn);
    Persistence.setActiveConnectionId(connectionId);
    Persistence.setActiveView(connectionId, "tables");
    
    fetch("/api/db/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(conn),
    }).then(() => {
      // Check for table parameter in URL first (takes precedence over saved state)
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const tableParam = urlParams.get("table");
        if (tableParam) {
          const [schema, table] = tableParam.split(".");
          if (schema && table) {
            // Clear the URL param after opening to avoid reopening on refresh
            window.history.replaceState({}, "", `/db/${connectionId}`);
            openTable(schema, table);
            return; // Don't load saved tabs if we're opening a new one
          }
        }
      }

      // Load saved tabs after connection is established
      const savedTabs = Persistence.getTableTabs(connectionId);
      const savedActiveTabId = Persistence.getActiveTabId(connectionId);
      
      if (savedTabs.length > 0) {
        setTableTabs(savedTabs);
        const activeTabToLoad = savedActiveTabId && savedTabs.find((t) => t.id === savedActiveTabId)
          ? savedTabs.find((t) => t.id === savedActiveTabId)!
          : savedTabs[savedTabs.length - 1];
        
        setActiveTabId(activeTabToLoad.id);
        // Load data for all tabs, but prioritize the active one
        savedTabs.forEach((tab) => {
          if (tab.id === activeTabToLoad.id) {
            loadTableData(tab.schema, tab.table, tab.id);
            loadTableInfo(tab.schema, tab.table, tab.id);
          }
        });
      }
    }).catch(console.error);
  }, [connectionId, openTable, loadTableData, loadTableInfo]);

  // Watch for URL parameter changes (for when navigating from schema explorer)
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    let lastTableParam: string | null = null;
    
    const checkUrlParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tableParam = urlParams.get("table");
      
      // Only process if it's a new table param (different from last one)
      if (tableParam && tableParam !== lastTableParam) {
        const [schema, table] = tableParam.split(".");
        if (schema && table) {
          console.log("[DatabasePage] URL param detected, opening table:", schema, table);
          lastTableParam = tableParam;
          
          // Clear the URL param first to prevent re-triggering
          window.history.replaceState({}, "", `/db/${connectionId}`);
          
          // Then open the table
          openTable(schema, table);
        }
      } else if (!tableParam) {
        // Reset lastTableParam when URL param is cleared
        lastTableParam = null;
      }
    };

    // Check immediately
    checkUrlParams();

    // Poll for URL changes (since router.push might not trigger popstate immediately)
    const interval = setInterval(checkUrlParams, 50);

    // Also listen for popstate events (back/forward navigation)
    window.addEventListener("popstate", checkUrlParams);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("popstate", checkUrlParams);
    };
  }, [connectionId, openTable]);

  const closeTab = (tabId: string) => {
    const newTabs = tableTabs.filter((t) => t.id !== tabId);
    setTableTabs(newTabs);
    
    const newActiveTabId = activeTabId === tabId 
      ? (newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null)
      : activeTabId;
    
    setActiveTabId(newActiveTabId);
    
    const newData = new Map(tableData);
    newData.delete(tabId);
    setTableData(newData);
  };

  const activeTab = tableTabs.find((t) => t.id === activeTabId);
  const activeData = activeTab ? tableData.get(activeTab.id) : null;

  // Redirect to connections page if connection not found (only after checking store)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!connectionId) return;
    
    // Check if connection exists in store - if it does, never redirect
    const conn = getConnection(connectionId);
    if (conn) {
      return; // Connection exists in store, let initialization handle it
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
        <DatabaseNavbar connectionId={connection.id} />
        <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <TableTabs
            tabs={tableTabs}
            activeTabId={activeTabId}
            onTabSelect={setActiveTabId}
            onTabClose={closeTab}
          />

          {activeTab ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-muted/20">
                <div>
                  <h1 className="text-lg font-semibold">{activeTab.table}</h1>
                  <p className="text-xs text-muted-foreground">{activeTab.schema}</p>
                </div>
                <div className="flex items-center gap-2">
                  <CreateTableDialog schema={activeTab.schema} onTableCreated={() => {
                    // Refresh schema explorer would go here
                  }} />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isRefreshing}
                    className={cn(
                      isRefreshing && "text-muted-foreground opacity-50"
                    )}
                    onClick={async () => {
                      if (activeTab) {
                        setIsRefreshing(true);
                        try {
                          await Promise.all([
                            loadTableData(activeTab.schema, activeTab.table, activeTab.id),
                            loadTableInfo(activeTab.schema, activeTab.table, activeTab.id),
                          ]);
                        } finally {
                          setIsRefreshing(false);
                        }
                      }
                    }}
                  >
                    {isRefreshing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden">
                <Tabs defaultValue="data" className="h-full flex flex-col">
                  <TabsList className="mx-6 mt-4 justify-start">
                    <TabsTrigger value="data">Data</TabsTrigger>
                    <TabsTrigger value="columns">Columns</TabsTrigger>
                    <TabsTrigger value="indexes">Indexes</TabsTrigger>
                    <TabsTrigger value="constraints">Constraints</TabsTrigger>
                  </TabsList>

                  <TabsContent value="data" className="flex-1 mt-4 overflow-hidden px-6 pb-6">
                    <ResultsViewer
                      result={activeData?.result || null}
                      error={activeData?.error || null}
                      loading={activeData?.loading || false}
                      schema={activeTab?.schema}
                      table={activeTab?.table}
                      columns={activeData?.columns || []}
                      primaryKeys={
                        connection?.provider === DatabaseProvider.MONGODB
                          ? ["_id"]
                          : activeData?.constraints
                              ?.filter((c) => c.type === "PRIMARY KEY")
                              .flatMap((c) => c.columns) || []
                      }
                      onRefresh={() => {
                        if (activeTab) {
                          loadTableData(activeTab.schema, activeTab.table, activeTab.id);
                        }
                      }}
                      enableCRUD={!!activeTab}
                      provider={connection?.provider}
                    />
                  </TabsContent>

                  <TabsContent value="columns" className="flex-1 mt-4 overflow-auto px-6 pb-6">
                    <div className="bg-card rounded-lg border border-border p-4">
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
                          {activeData?.columns.map((col) => (
                            <TableRow key={col.name}>
                              <TableCell className="font-mono font-medium">{col.name}</TableCell>
                              <TableCell>
                                {col.dataType}
                                {col.characterMaximumLength && (
                                  <span className="text-muted-foreground ml-1">
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

                  <TabsContent value="indexes" className="flex-1 mt-4 overflow-auto px-6 pb-6">
                    <div className="bg-card rounded-lg border border-border p-4">
                      {activeData?.indexes.length === 0 ? (
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
                            {activeData?.indexes.map((idx) => (
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

                  <TabsContent value="constraints" className="flex-1 mt-4 overflow-auto px-6 pb-6">
                    <div className="bg-card rounded-lg border border-border p-4">
                      {activeData?.constraints.length === 0 ? (
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
                            {activeData?.constraints.map((constraint) => (
                              <TableRow key={constraint.name}>
                                <TableCell className="font-mono">{constraint.name}</TableCell>
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
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">No table selected</p>
                <p className="text-sm text-muted-foreground">
                  Select a table from the schema explorer to view its data
                </p>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </MainLayout>
  );
}
