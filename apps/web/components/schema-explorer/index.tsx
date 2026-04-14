"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Loader2, Plus, RefreshCw, Table as TableIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CreateTableDialog } from "@/components/create-table-dialog";
import { EditTableDialog } from "@/components/edit-table-dialog";
import { SchemaChangePreviewDialog } from "@/components/schema-change-preview-dialog";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { getConnection } from "@/lib/connections/store";
import { DatabaseProvider } from "@/lib/db/providers";
import { schemaChangeStager, type SchemaChange } from "@/lib/query/schema-change-stager";
import { toast } from "sonner";
import { useSchemas } from "@/lib/query/hooks/use-schemas";
import { useTables } from "@/lib/query/hooks/use-tables";
import { useExecuteQuery } from "@/lib/query/hooks/use-query";

import type { Schema, Table } from "./types";
import { SchemaSelector } from "./SchemaSelector";
import { TableSearch } from "./TableSearch";

interface SchemaExplorerProps {
  connectionId?: string;
  onTableSelect?: (schema: string, table: string) => void;
  onTableCreated?: () => void;
  onOpenNewTableTab?: (schema: string) => void;
  refreshKey?: number;
}

function SchemaExplorerLoadingState() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SchemaExplorer({
  connectionId,
  onTableSelect,
  onTableCreated,
  onOpenNewTableTab,
}: SchemaExplorerProps) {
  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [schemaSearchTerm, setSchemaSearchTerm] = useState("");
  const [showCreateSchemaDialog, setShowCreateSchemaDialog] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState("");
  const [editingTable, setEditingTable] = useState<{ schema: string; table: string; columns: any[] } | null>(null);
  const [showEditTableDialog, setShowEditTableDialog] = useState(false);
  const [showSchemaChangePreview, setShowSchemaChangePreview] = useState(false);
  const [pendingSchemaChanges, setPendingSchemaChanges] = useState<SchemaChange[]>([]);
  const [deletingTable, setDeletingTable] = useState<{ schema: string; table: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isMongoDB = connectionId ? getConnection(connectionId)?.provider === DatabaseProvider.MONGODB : false;

  const { data: schemaList = [], isLoading: schemasLoading, refetch: refetchSchemas } = useSchemas(connectionId || undefined);
  
  const schemas: Schema[] = useMemo(() => {
    return schemaList.map((name: string) => ({
      name,
      tables: undefined,
    }));
  }, [schemaList]);

  const { data: tables = [], isLoading: tablesLoading, refetch: refetchTables } = useTables(connectionId || undefined, selectedSchema || undefined);

  const { mutateAsync: executeQuery, isPending: queryLoading } = useExecuteQuery(connectionId);

  const isRefreshingTables = tablesLoading;

useEffect(() => {
  if (schemas.length > 0 && !selectedSchema) {
    setSelectedSchema(schemas[0].name);
  }
}, [schemas, selectedSchema]);

  const handleSchemaSelect = useCallback(async (schemaName: string) => {
    setSelectedSchema(schemaName);
  }, []);

  const handleRefreshTables = useCallback(() => {
    if (selectedSchema) {
      refetchTables();
    }
  }, [selectedSchema, refetchTables]);

  const filteredSchemas = useMemo(() => {
    if (!tableSearchTerm.trim()) return schemas;

    const searchLower = tableSearchTerm.toLowerCase();
    return schemas
      .map((schema) => {
        if (!schema.tables) return schema;
        const filteredTables = schema.tables.filter((table) =>
          table.name.toLowerCase().includes(searchLower)
        );
        return { ...schema, tables: filteredTables };
      })
      .filter((schema) => {
        return (schema.tables && schema.tables.length > 0) ||
          schema.name.toLowerCase().includes(searchLower);
      });
  }, [schemas, tableSearchTerm]);

  const filteredSchemasForSelector = useMemo(() => {
    const sorted = [...schemas].sort((a, b) => {
      if (a.name === "public") return -1;
      if (b.name === "public") return 1;
      return a.name.localeCompare(b.name);
    });

    if (!schemaSearchTerm || schemaSearchTerm.trim() === "") return sorted;

    const searchLower = schemaSearchTerm.toLowerCase();
    return sorted.filter((s) => s.name.toLowerCase().includes(searchLower));
  }, [schemas, schemaSearchTerm]);

  if (!connectionId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Connect to a database to view schemas
      </div>
    );
  }

  if (schemasLoading && schemas.length === 0) {
    return <SchemaExplorerLoadingState />;
  }

  if (!schemasLoading && schemas.length === 0) {
    return (
      <div className="p-4 space-y-2">
        <div className="text-sm text-muted-foreground">No schemas found</div>
        <button onClick={() => refetchSchemas()} className="text-xs text-primary hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const handleCreateSchema = async () => {
    if (!newSchemaName.trim() || !connectionId) return;

    try {
      const result = await executeQuery({
        query: `CREATE SCHEMA IF NOT EXISTS "${newSchemaName.trim()}"`,
      });

      if (!result.success) {
        toast.error("Failed to create schema", { description: result.error || "Unknown error" });
        return;
      }

      toast.success("Schema created successfully");
      setShowCreateSchemaDialog(false);
      setNewSchemaName("");
      refetchSchemas();
    } catch (error) {
      toast.error("Failed to create schema", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleDeleteTable = async () => {
    if (!deletingTable) return;

    try {
      const result = await executeQuery({
        query: `DROP TABLE "${deletingTable.schema}"."${deletingTable.table}" CASCADE`,
      });

      if (!result.success) {
        toast.error("Failed to delete table", { description: result.error || "Unknown error" });
        return;
      }

      toast.success("Table deleted successfully");
      setShowDeleteConfirm(false);
      setDeletingTable(null);
      if (selectedSchema) refetchTables();
    } catch (error) {
      toast.error("Failed to delete table", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleApplySchemaChanges = async () => {
    for (const change of pendingSchemaChanges) {
      for (const query of change.queries) {
        const result = await executeQuery({ query });
        if (!result.success) {
          throw new Error(result.error || `Failed to apply change: ${change.description}`);
        }
      }
    }
    schemaChangeStager.clearChanges();
    setPendingSchemaChanges([]);
    if (selectedSchema) refetchTables();
    toast.success("Schema changes applied successfully");
  };

  return (
    <div className="space-y-2">
      <div className="px-2 space-y-2">
        {!isMongoDB && (
          <SchemaSelector
            schemas={filteredSchemasForSelector.map((s) => s.name)}
            selectedSchema={selectedSchema}
            onSchemaSelect={handleSchemaSelect}
            onCreateSchema={() => setShowCreateSchemaDialog(true)}
          />
        )}

        <TableSearch value={tableSearchTerm} onChange={setTableSearchTerm} />
      </div>

      <div className="space-y-1">
        {selectedSchema && !isMongoDB && (
          <div className="flex items-center justify-between px-2 py-2 mb-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tables
            </div>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn("h-6 w-6 hover:text-foreground", isRefreshingTables && "text-muted-foreground opacity-50")}
                      disabled={isRefreshingTables}
                      onClick={handleRefreshTables}
                    >
                      {isRefreshingTables ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh tables</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onOpenNewTableTab?.(selectedSchema || "public")}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create new table</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}

        {selectedSchema ? (
          (() => {
            const tablesToShow = tables;
            const filteredTables = tableSearchTerm.trim()
              ? tablesToShow.filter((table) =>
                  table.name.toLowerCase().includes(tableSearchTerm.toLowerCase())
                )
              : tablesToShow;

            return (
              <div className="space-y-0.5">
                {filteredTables.map((table) => (
                  <div
                    key={`${table.schema}.${table.name}`}
                    className="group flex items-center gap-1"
                  >
                    <button
                      onClick={() => onTableSelect?.(table.schema, table.name)}
                      className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <TableIcon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{table.name}</span>
                      {table.rowCount !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {table.rowCount.toLocaleString()}
                        </span>
                      )}
                    </button>
                  </div>
                ))}
                {filteredTables.length === 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">
                    {tableSearchTerm ? "No tables found" : isMongoDB ? "No collections" : "No tables"}
                  </div>
                )}
              </div>
            );
          })()
        ) : isMongoDB ? (
          filteredSchemas.map((schema) =>
            schema.tables?.map((table) => (
              <button
                key={`${table.schema}.${table.name}`}
                onClick={() => onTableSelect?.(table.schema, table.name)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                <TableIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{table.name}</span>
                {table.rowCount !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {table.rowCount.toLocaleString()}
                  </span>
                )}
              </button>
            ))
          )
        ) : (
          <div className="px-2 py-1 text-sm text-muted-foreground">
            Select a schema to view tables
          </div>
        )}
      </div>

      {!isMongoDB && (
        <Dialog open={showCreateSchemaDialog} onOpenChange={setShowCreateSchemaDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Schema</DialogTitle>
              <DialogDescription>Create a new database schema</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Schema Name</label>
                <Input
                  value={newSchemaName}
                  onChange={(e) => setNewSchemaName(e.target.value)}
                  placeholder="my_schema"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSchemaName.trim()) {
                      handleCreateSchema();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateSchemaDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSchema} disabled={!newSchemaName.trim() || queryLoading}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editingTable && (
        <EditTableDialog
          open={showEditTableDialog}
          onOpenChange={(open) => {
            setShowEditTableDialog(open);
            if (!open) setEditingTable(null);
          }}
          schema={editingTable.schema}
          table={editingTable.table}
          columns={editingTable.columns}
          onChangesStaged={(changes) => {
            setPendingSchemaChanges(changes);
            setShowSchemaChangePreview(true);
            setShowEditTableDialog(false);
          }}
        />
      )}

      <SchemaChangePreviewDialog
        open={showSchemaChangePreview}
        onOpenChange={setShowSchemaChangePreview}
        changes={pendingSchemaChanges}
        onConfirm={handleApplySchemaChanges}
        onCancel={() => {
          schemaChangeStager.clearChanges();
          setPendingSchemaChanges([]);
        }}
      />

      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Table"
        description={`Are you sure you want to delete table "${deletingTable?.schema}.${deletingTable?.table}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteTable}
      />
    </div>
  );
}
