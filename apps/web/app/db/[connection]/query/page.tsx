"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { DatabaseNavbar } from "@/components/database-navbar";
import { SQLEditor } from "@/components/sql-editor";
import { ResultsViewer } from "@/components/results-viewer";
import { QueryTabs, type QueryTab } from "@/components/query-tabs";
import { SafeModeToggle } from "@/components/safe-mode-toggle";
import { QueryConfirmationDialog } from "@/components/query-confirmation-dialog";
import { QueryPlanViewer } from "@/components/query-plan-viewer";
import { SavedQueriesManager } from "@/components/saved-queries-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play, Plus, Eye, Bookmark, Save } from "lucide-react";
import { SavedQueries } from "@/lib/query/saved-queries";
import { getConnection } from "@/lib/connections/store";
import { Persistence } from "@/lib/persistence";
import type { ConnectionConfig } from "@/lib/db/types";
import { DatabaseProvider } from "@/lib/db/providers";
import { analyzeQuery, shouldBlockQuery, type QueryAnalysis } from "@/lib/query/classifier";
import type { SavedQuery } from "@/lib/query/saved-queries";

interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: Array<{ name: string; dataTypeID: number }>;
}

function getDefaultQuery(provider?: DatabaseProvider): string {
  if (provider === DatabaseProvider.MONGODB) {
    return `db.collection.find({}).limit(100)`;
  }
  return `SELECT 1;`;
}

function getEditorLanguage(provider?: DatabaseProvider): "sql" | "javascript" {
  return provider === DatabaseProvider.MONGODB ? "javascript" : "sql";
}

export default function QueryPage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.connection as string;
  const [connection, setConnection] = useState<ConnectionConfig | null>(null);
  const [queryTabs, setQueryTabs] = useState<QueryTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [safeMode, setSafeMode] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [queryAnalysis, setQueryAnalysis] = useState<QueryAnalysis | null>(null);
  const [queryPlan, setQueryPlan] = useState<any>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [showSavedQueries, setShowSavedQueries] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveFormData, setSaveFormData] = useState({
    name: "",
    tags: "",
    description: "",
  });
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef<string | null>(null);

  // Get current query from active tab
  const currentQuery = queryTabs.find((tab) => tab.id === activeTabId)?.query || "";

  // Persist tabs whenever they change
  useEffect(() => {
    if (connectionId && queryTabs.length >= 0) {
      Persistence.setQueryTabs(connectionId, queryTabs);
    }
  }, [connectionId, queryTabs]);

  // Persist active tab whenever it changes
  useEffect(() => {
    if (connectionId && activeTabId) {
      Persistence.setActiveQueryTabId(connectionId, activeTabId);
    }
  }, [connectionId, activeTabId]);

  // Auto-save query content (debounced)
  const autoSaveQuery = useCallback(
    (tabId: string, query: string) => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        if (connectionId) {
          Persistence.setQueryTabContent(connectionId, tabId, query);
        }
      }, 1000); // 1 second debounce
    },
    [connectionId]
  );

  // Update query in active tab
  const updateQuery = useCallback(
    (newQuery: string) => {
      if (!activeTabId) return;
      setQueryTabs((prev) => {
        const updated = prev.map((tab) =>
          tab.id === activeTabId ? { ...tab, query: newQuery } : tab
        );
        autoSaveQuery(activeTabId, newQuery);
        return updated;
      });
    },
    [activeTabId, autoSaveQuery]
  );

  // Create new query tab
  const createNewTab = useCallback(() => {
    const tabId = `query-${Date.now()}`;
    const newTab: QueryTab = {
      id: tabId,
      label: `Query ${queryTabs.length + 1}`,
      query: getDefaultQuery(connection?.provider),
    };
    setQueryTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);
  }, [queryTabs.length, connection?.provider]);

  // Select a tab
  const selectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  // Close a tab
  const closeTab = useCallback(
    (tabId: string) => {
      setQueryTabs((prev) => {
        const filtered = prev.filter((tab) => tab.id !== tabId);
        if (filtered.length === 0) {
          // If no tabs left, create a new one
          const newTabId = `query-${Date.now()}`;
          const newTab: QueryTab = {
            id: newTabId,
            label: "Query 1",
            query: getDefaultQuery(connection?.provider),
          };
          setActiveTabId(newTabId);
          return [newTab];
        }
        // If closing active tab, switch to another one
        if (activeTabId === tabId) {
          const currentIndex = prev.findIndex((tab) => tab.id === tabId);
          const nextTab = filtered[currentIndex] || filtered[currentIndex - 1] || filtered[0];
          setActiveTabId(nextTab.id);
        }
        return filtered;
      });
    },
    [activeTabId, connection?.provider]
  );

  // Rename a tab
  const renameTab = useCallback((tabId: string, newLabel: string) => {
    setQueryTabs((prev) => {
      const updated = prev.map((tab) =>
        tab.id === tabId ? { ...tab, label: newLabel } : tab
      );
      return updated;
    });
  }, []);

  // Internal query execution function
  const executeQueryInternal = useCallback(async (query: string) => {
    if (!query.trim() || !activeTabId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.error || "Query failed";
        setError(errorMsg);
        toast.error("Query failed", {
          description: errorMsg,
        });
        return;
      }

      // Handle EXPLAIN plan
      if (data.data?.isExplain) {
        setQueryPlan(data.data.plan);
        setShowPlan(true);
        setResult(null);
        toast.success("Query plan generated");
        return;
      }

      setResult(data.data);
      setQueryPlan(null);
      setShowPlan(false);
      toast.success("Query executed", {
        description: `Returned ${data.data?.rowCount || 0} row${data.data?.rowCount !== 1 ? "s" : ""}`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Query failed";
      setError(errorMsg);
      toast.error("Query failed", {
        description: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  }, [activeTabId]);

  // Handle confirmation
  const handleConfirm = useCallback(async () => {
    if (pendingQuery) {
      setShowConfirmation(false);
      setPendingQuery(null);
      setQueryAnalysis(null);
      await executeQueryInternal(pendingQuery);
    }
  }, [pendingQuery, executeQueryInternal]);

  const handleCancel = useCallback(() => {
    setShowConfirmation(false);
    setPendingQuery(null);
    setQueryAnalysis(null);
  }, []);

  // Execute query
  const executeQuery = useCallback(async () => {
    if (!currentQuery.trim()) return;
    
    // Check safe mode if enabled
    if (safeMode && connection) {
      const analysis = analyzeQuery(currentQuery);
      const blockResult = shouldBlockQuery(analysis, safeMode);
      
      if (blockResult.blocked) {
        toast.error("Query blocked by Safe Mode", {
          description: blockResult.reason,
        });
        return;
      }
      
      // If destructive, show confirmation dialog
      if (analysis.isDestructive) {
        setPendingQuery(currentQuery);
        setQueryAnalysis(analysis);
        setShowConfirmation(true);
        return;
      }
    }
    
    await executeQueryInternal(currentQuery);
  }, [currentQuery, executeQueryInternal, safeMode, connection]);

  // Initialize connection and load saved tabs
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initializedRef.current === connectionId) return;

    const conn = getConnection(connectionId);
    if (!conn) return;

    initializedRef.current = connectionId;
    setConnection(conn);
    setSafeMode(Persistence.getSafeMode(connectionId));
    Persistence.setActiveConnectionId(connectionId);
    Persistence.setActiveView(connectionId, "query");

    // Auto-connect
    fetch("/api/db/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(conn),
    })
      .then(() => {
        // Load saved tabs
        const savedTabs = Persistence.getQueryTabs(connectionId);
        const savedActiveTabId = Persistence.getActiveQueryTabId(connectionId);

        if (savedTabs.length > 0) {
          setQueryTabs(savedTabs);
          const activeTab =
            savedActiveTabId && savedTabs.find((t) => t.id === savedActiveTabId)
              ? savedTabs.find((t) => t.id === savedActiveTabId)!
              : savedTabs[0];
          setActiveTabId(activeTab.id);
        } else {
          // Create initial tab
          const initialTabId = `query-${Date.now()}`;
          const initialTab: QueryTab = {
            id: initialTabId,
            label: "Query 1",
            query: getDefaultQuery(conn.provider),
          };
          setQueryTabs([initialTab]);
          setActiveTabId(initialTabId);
        }
      })
      .catch(console.error);
  }, [connectionId]);

  // Cleanup auto-save timeout
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const handleRunSavedQuery = useCallback((query: string) => {
    // Find active tab or create new one
    if (activeTabId) {
      updateQuery(query);
    } else {
      createNewTab();
      // Wait a bit for tab to be created, then update
      setTimeout(() => {
        const newTabId = queryTabs[queryTabs.length - 1]?.id;
        if (newTabId) {
          setQueryTabs((prev) => {
            const updated = prev.map((tab) =>
              tab.id === newTabId ? { ...tab, query } : tab
            );
            return updated;
          });
          setActiveTabId(newTabId);
        }
      }, 100);
    }
    setShowSavedQueries(false);
  }, [activeTabId, queryTabs, updateQuery, createNewTab]);

  const handleSaveCurrentQuery = useCallback(() => {
    if (!currentQuery.trim() || !connection) return;
    setSaveFormData({ name: "", tags: "", description: "" });
    setShowSaveDialog(true);
  }, [currentQuery, connection]);

  const handleSaveSubmit = useCallback(() => {
    if (!saveFormData.name.trim() || !currentQuery.trim() || !connection) return;

    const tags = saveFormData.tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const savedQuery: SavedQuery = {
      id: `query-${Date.now()}`,
      name: saveFormData.name,
      query: currentQuery,
      description: saveFormData.description || undefined,
      tags,
      connectionId: connection.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    SavedQueries.save(savedQuery);
    toast.success("Query saved");
    setShowSaveDialog(false);
    setSaveFormData({ name: "", tags: "", description: "" });
  }, [saveFormData, currentQuery, connection]);

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

  const editorLanguage = getEditorLanguage(connection.provider);

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <DatabaseNavbar connectionId={connection.id} />
        
        <div className="flex flex-1 min-h-0">
          {/* Saved Queries Sidebar */}
          {showSavedQueries && (
            <div className="w-80 border-r border-border flex flex-col shrink-0">
              <SavedQueriesManager
                connectionId={connection.id}
                onRunQuery={handleRunSavedQuery}
                className="h-full"
              />
            </div>
          )}
          
          <div className="flex flex-col flex-1 min-w-0">
            {/* Query Tabs */}
            <QueryTabs
              tabs={queryTabs}
              activeTabId={activeTabId}
              onTabSelect={selectTab}
              onTabClose={closeTab}
              onTabRename={renameTab}
            />
            {/* Command Bar */}
            <div className="h-12 border-b border-border flex items-center gap-2 px-4 shrink-0 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                <Button
                  onClick={() => setShowSavedQueries(!showSavedQueries)}
                  variant={showSavedQueries ? "default" : "outline"}
                  size="sm"
                >
                  <Bookmark className="h-4 w-4 mr-2" />
                  Saved
                </Button>
                <Button onClick={createNewTab} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Query
                </Button>
                <SafeModeToggle
                  enabled={safeMode}
                  onToggle={(enabled) => {
                    setSafeMode(enabled);
                    if (connectionId) {
                      Persistence.setSafeMode(connectionId, enabled);
                    }
                  }}
                />
                <div className="flex-1" />
                <Button
                  onClick={handleSaveCurrentQuery}
                  variant="outline"
                  size="sm"
                  disabled={!currentQuery.trim()}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button
                  onClick={async () => {
                    if (!currentQuery.trim() || !activeTabId) return;
                    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${currentQuery}`;
                    await executeQueryInternal(explainQuery);
                  }}
                  variant="outline"
                  size="sm"
                  disabled={loading || !currentQuery.trim()}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Explain
                </Button>
                <Button onClick={executeQuery} disabled={loading || !currentQuery.trim()}>
                  <Play className="h-4 w-4 mr-2" />
                  Run Query
                </Button>
                <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                  Cmd/Ctrl + Enter
                </span>
              </div>
            </div>

            {/* Query Editor */}
            <div className="flex-1 min-h-0">
              <SQLEditor
                value={currentQuery}
                onChange={updateQuery}
                onExecute={executeQuery}
                disabled={loading}
                language={editorLanguage}
              />
            </div>

            {/* Results / Plan */}
            <div className="h-96 border-t border-border shrink-0">
              {showPlan && queryPlan ? (
                <QueryPlanViewer plan={queryPlan} className="h-full p-4" />
              ) : (
                <ResultsViewer
                  result={result}
                  error={error}
                  loading={loading}
                  provider={connection.provider}
                />
              )}
            </div>

            {/* Confirmation Dialog */}
            {queryAnalysis && (
              <QueryConfirmationDialog
                open={showConfirmation}
                onOpenChange={setShowConfirmation}
                query={pendingQuery || ""}
                analysis={queryAnalysis}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              />
            )}

            {/* Save Query Dialog */}
            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Query</DialogTitle>
                  <DialogDescription>
                    Save this query for quick access later
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="save-name">Name *</Label>
                    <Input
                      id="save-name"
                      value={saveFormData.name}
                      onChange={(e) =>
                        setSaveFormData({ ...saveFormData, name: e.target.value })
                      }
                      placeholder="My Query"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label htmlFor="save-description">Description</Label>
                    <Input
                      id="save-description"
                      value={saveFormData.description}
                      onChange={(e) =>
                        setSaveFormData({ ...saveFormData, description: e.target.value })
                      }
                      placeholder="Optional description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="save-tags">Tags</Label>
                    <Input
                      id="save-tags"
                      value={saveFormData.tags}
                      onChange={(e) =>
                        setSaveFormData({ ...saveFormData, tags: e.target.value })
                      }
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveSubmit}
                    disabled={!saveFormData.name.trim()}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
