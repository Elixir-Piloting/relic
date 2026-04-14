"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { DatabaseNavbar } from "@/components/database-navbar";
import { TableTabs, type TableTab } from "@/components/table-tabs";
import { CreateTableDialog } from "@/components/create-table-dialog";
import { ResultsViewer, PAGE_SIZE_OPTIONS } from "@/components/results-viewer";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RefreshCw, Loader2, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getConnectionAsync } from "@/lib/connections/store";
import { Persistence } from "@/lib/persistence";
import type { ConnectionConfig } from "@/lib/db/types";
import { DatabaseProvider } from "@/lib/db/providers";
import { cn } from "@/lib/utils";
import { useTableData, useRefreshTableData } from "@/lib/query/hooks/use-table-data";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

function TableLoadingSkeleton() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-muted/20">
        <div>
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-4 mx-6 mt-4">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="flex-1 mt-4 overflow-auto px-6 pb-6">
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DatabasePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const connectionId = params.connection as string;
  
  const [connection, setConnection] = useState<ConnectionConfig | null>(null);
  const [tableTabs, setTableTabs] = useState<TableTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const initializedRef = useRef<string | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [activePageSize, setActivePageSize] = useState(100);
  const [pageSizePopoverOpen, setPageSizePopoverOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeTab = tableTabs.find((t) => t.id === activeTabId);
  
  const { 
    data: tableDataResponse, 
    isLoading: tableLoading, 
    error: tableError,
    refetch: refetchTableData 
  } = useTableData(
    connectionId,
    activeTab?.schema,
    activeTab?.table,
    activePage,
    activePageSize,
    connection?.provider
  );

  useEffect(() => {
    if (connectionId && tableTabs.length >= 0) {
      Persistence.setTableTabs(connectionId, tableTabs);
    }
  }, [connectionId, tableTabs]);

  useEffect(() => {
    if (connectionId && activeTabId) {
      Persistence.setActiveTabId(connectionId, activeTabId);
    }
  }, [connectionId, activeTabId]);

  const openTable = useCallback((schema: string, table: string) => {
    const tabId = `${schema}.${table}`;
    
    setTableTabs((prevTabs) => {
      const existingTab = prevTabs.find((t) => t.id === tabId);
      
      if (existingTab) {
        setActiveTabId(tabId);
        if (connectionId) {
          Persistence.setActiveTabId(connectionId, tabId);
        }
        return prevTabs;
      }
      
      const newTab: TableTab = {
        id: tabId,
        schema,
        table,
        label: `${schema}.${table}`,
      };
      const updatedTabs = [...prevTabs, newTab];
      setActiveTabId(tabId);
      setActivePage(1);
      
      return updatedTabs;
    });
  }, [connectionId]);

  const openNewTableTab = useCallback((schema: string) => {
    const tabId = `__create_table__`;
    
    setTableTabs((prevTabs) => {
      const existingTab = prevTabs.find((t) => t.id === tabId);
      
      if (existingTab) {
        setActiveTabId(tabId);
        if (connectionId) {
          Persistence.setActiveTabId(connectionId, tabId);
        }
        return prevTabs;
      }
      
      const newTab: TableTab = {
        id: tabId,
        schema,
        table: "",
        label: "New Table",
        type: "create",
      };
      const updatedTabs = [...prevTabs, newTab];
      setActiveTabId(tabId);
      
      return updatedTabs;
    });
  }, [connectionId]);

  const closeTab = useCallback((tabId: string) => {
    setTableTabs((prevTabs) => {
      const newTabs = prevTabs.filter((t) => t.id !== tabId);
      
      if (activeTabId === tabId) {
        const closedIndex = prevTabs.findIndex((t) => t.id === tabId);
        const newActiveTab = newTabs[closedIndex] || newTabs[closedIndex - 1] || null;
        setActiveTabId(newActiveTab?.id || null);
        if (connectionId && newActiveTab) {
          Persistence.setActiveTabId(connectionId, newActiveTab.id);
        }
      }
      
      return newTabs;
    });
  }, [activeTabId, connectionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initializedRef.current === connectionId) return;
    
    getConnectionAsync(connectionId).then(conn => {
      if (!conn) {
        return;
      }

      initializedRef.current = connectionId;
      setConnection(conn);
      Persistence.setActiveConnectionId(connectionId);
      Persistence.setActiveView(connectionId, "tables");
      
      fetch("/api/db/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conn),
      })
        .then(() => {
          if (typeof window !== "undefined") {
            const urlParams = new URLSearchParams(window.location.search);
            const tableParam = urlParams.get("table");
            const newTableParam = urlParams.get("newTable");
            
            if (newTableParam) {
              window.history.replaceState({}, "", `/db/${connectionId}`);
              openNewTableTab(newTableParam);
              return;
            }
            
            if (tableParam) {
              const [schema, table] = tableParam.split(".");
              if (schema && table) {
                window.history.replaceState({}, "", `/db/${connectionId}`);
                openTable(schema, table);
                return;
              }
            }
          }

          const savedTabs = Persistence.getTableTabs(connectionId);
          const savedActiveTabId = Persistence.getActiveTabId(connectionId);
          
          if (savedTabs.length > 0) {
            setTableTabs(savedTabs);
            const activeTabToLoad = savedActiveTabId && savedTabs.find((t) => t.id === savedActiveTabId)
              ? savedTabs.find((t) => t.id === savedActiveTabId)!
              : savedTabs[savedTabs.length - 1];
            
            setActiveTabId(activeTabToLoad.id);
          }
        });
      })
      .catch(console.error);
  }, [connectionId, openTable, openNewTableTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    let lastTableParam: string | null = null;
    
    const checkUrlParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tableParam = urlParams.get("table");
      const newTableParam = urlParams.get("newTable");
      
      if (newTableParam && newTableParam !== lastTableParam) {
        lastTableParam = newTableParam;
        window.history.replaceState({}, "", `/db/${connectionId}`);
        openNewTableTab(newTableParam);
        return;
      }
      
      if (tableParam && tableParam !== lastTableParam) {
        const [schema, table] = tableParam.split(".");
        if (schema && table) {
          lastTableParam = tableParam;
          window.history.replaceState({}, "", `/db/${connectionId}`);
          openTable(schema, table);
        }
      } else if (!tableParam && !newTableParam) {
        lastTableParam = null;
      }
    };

    checkUrlParams();
    const interval = setInterval(checkUrlParams, 200);
    window.addEventListener("popstate", checkUrlParams);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("popstate", checkUrlParams);
    };
  }, [connectionId, openTable, openNewTableTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!connectionId) return;
    
    if (connection) {
      return;
    }
    
    if (!initializedRef.current) {
      return;
    }
  }, [connectionId, connection]);

  if (!connection && !initializedRef.current) {
    return (
      <MainLayout>
        <div className="flex flex-col h-full">
          <DatabaseNavbar connectionId="" />
          <TableLoadingSkeleton />
        </div>
      </MainLayout>
    );
  }

  if (!connection) {
    return (
      <MainLayout>
        <div className="flex flex-col h-full">
          <DatabaseNavbar connectionId="" />
          <TableLoadingSkeleton />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <DatabaseNavbar connectionId={connection.id} />
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <TableTabs
              tabs={tableTabs}
              activeTabId={activeTabId}
              onTabSelect={setActiveTabId}
              onTabClose={closeTab}
            />

            {activeTab ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className={cn(
                  "h-auto min-h-12 border-b border-border flex items-center justify-between px-6 py-2 shrink-0 bg-muted/20 gap-4",
                  activeTab.type === "create" && "hidden"
                )}>
                  <div className="flex items-center gap-3 shrink-0">
                    <CreateTableDialog schema={activeTab.schema} onTableCreated={() => {
                      queryClient.invalidateQueries({ queryKey: queryKeys.db.tables(connectionId, activeTab.schema) });
                    }} />
                    {tableDataResponse?.result && (
                      <Button variant="outline" size="sm" onClick={() => {}}>
                        <Plus className="h-4 w-4 mr-1" /> Insert
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={tableLoading}
                      className={cn(
                        tableLoading && "text-muted-foreground opacity-50"
                      )}
                      onClick={() => refetchTableData()}
                    >
                      {tableLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {tableDataResponse?.result && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="text-xs">
                        {tableDataResponse.result.rowCount.toLocaleString()} {connection?.provider === DatabaseProvider.MONGODB ? "document" : "row"}{tableDataResponse.result.rowCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-border">·</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">Rows per page</span>
                        <Popover open={pageSizePopoverOpen} onOpenChange={setPageSizePopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs font-medium min-w-[3.5rem]"
                            >
                              {activePageSize}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-28 p-1" align="start">
                            <div className="flex flex-col">
                              {PAGE_SIZE_OPTIONS.map((size) => (
                                <button
                                  key={size}
                                  onClick={() => { setActivePageSize(size); setActivePage(1); setPageSizePopoverOpen(false); }}
                                  className={cn(
                                    "flex items-center justify-between rounded-sm px-2 py-1.5 text-sm cursor-pointer transition-colors",
                                    "hover:bg-accent hover:text-accent-foreground",
                                    activePageSize === size && "bg-accent text-accent-foreground font-medium"
                                  )}
                                >
                                  <span>{size}</span>
                                  {activePageSize === size && <Check className="h-3.5 w-3.5" />}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <span className="text-border">·</span>
                      {(() => {
                        const totalPages = Math.max(1, Math.ceil(tableDataResponse.result.rowCount / activePageSize));
                        const startRow = tableDataResponse.result.rowCount > 0 ? (activePage - 1) * activePageSize + 1 : 0;
                        const endRow = Math.min(activePage * activePageSize, tableDataResponse.result.rowCount);
                        return (
                          <>
                            <span className="tabular-nums text-xs">
                              {startRow}–{endRow} of {tableDataResponse.result.rowCount.toLocaleString()}
                            </span>
                            <span className="text-xs">
                              ({activePage}/{totalPages})
                            </span>
                            <div className="flex items-center gap-0.5">
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setActivePage(1)} disabled={activePage <= 1} title="First page">
                                <ChevronsLeft className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setActivePage(p => Math.max(1, p - 1))} disabled={activePage <= 1} title="Previous page">
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setActivePage(p => p + 1)} disabled={activePage >= totalPages} title="Next page">
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setActivePage(totalPages)} disabled={activePage >= totalPages} title="Last page">
                                <ChevronsRight className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-hidden px-6 pb-6 pt-4">
                  {activeTab.type === "create" ? (
                    <div className="h-full flex flex-col">
                      <CreateTableDialog
                        schema={activeTab.schema}
                        openInPage
                        onTableCreated={() => {
                          queryClient.invalidateQueries({ queryKey: queryKeys.db.tables(connectionId, activeTab.schema) });
                          queryClient.invalidateQueries({ queryKey: queryKeys.db.schema(connectionId) });
                          closeTab(activeTab.id);
                        }}
                      />
                    </div>
                  ) : (
                    <ResultsViewer
                      result={tableDataResponse?.result || null}
                      error={tableError?.message || null}
                      loading={tableLoading}
                      schema={activeTab?.schema}
                      table={activeTab?.table}
                      columns={tableDataResponse?.columns || []}
                      primaryKeys={
                        connection?.provider === DatabaseProvider.MONGODB
                          ? ["_id"]
                          : tableDataResponse?.constraints
                              ?.filter((c) => c.type === "PRIMARY KEY")
                              .flatMap((c) => c.columns) || []
                      }
                      onRefresh={() => refetchTableData()}
                      enableCRUD={!!activeTab}
                      provider={connection?.provider}
                      page={activePage}
                      pageSize={activePageSize}
                      onPageChange={setActivePage}
                      onPageSizeChange={(size) => { setActivePageSize(size); setActivePage(1); }}
                      showPagination={false}
                    />
                  )}
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
