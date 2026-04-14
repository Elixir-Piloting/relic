"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronRight, ChevronDown, Table, Database, Loader2, Search, Plus, RefreshCw, Edit2, Trash2, MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CreateTableDialog } from "@/components/create-table-dialog";
import { EditTableDialog } from "@/components/edit-table-dialog";
import { SchemaChangePreviewDialog } from "@/components/schema-change-preview-dialog";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Persistence } from "@/lib/persistence";
import { getConnection } from "@/lib/connections/store";
import { DatabaseProvider } from "@/lib/db/providers";
import { schemaChangeStager, type SchemaChange } from "@/lib/query/schema-change-stager";
import type { ColumnInfo } from "@/lib/db/types";
import { toast } from "sonner";

interface Schema {
  name: string;
  tables?: Table[];
}

interface Table {
  schema: string;
  name: string;
  rowCount?: number;
}

interface SchemaExplorerProps {
  connectionId?: string;
  onTableSelect?: (schema: string, table: string) => void;
  onTableCreated?: () => void;
}

export function SchemaExplorer({
  connectionId,
  onTableSelect,
  onTableCreated,
}: SchemaExplorerProps) {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [isMongoDB, setIsMongoDB] = useState(false);
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
  const [isRefreshingTables, setIsRefreshingTables] = useState(false);

  useEffect(() => {
    if (!connectionId) {
      setSchemas([]);
      setLoading(false);
      setExpandedSchemas(new Set());
      setIsMongoDB(false);
      return;
    }

    // Check if this is a MongoDB connection
    const conn = getConnection(connectionId);
    setIsMongoDB(conn?.provider === DatabaseProvider.MONGODB);

    // Set loading immediately and wait a bit for connection to be established
    setLoading(true);
    const timer = setTimeout(() => {
      loadSchemas();
    }, 300);

    return () => clearTimeout(timer);
  }, [connectionId]);

  // Set first schema as default when schemas load
  useEffect(() => {
    if (schemas.length > 0 && !selectedSchema) {
      const firstSchema = schemas[0].name;
      setSelectedSchema(firstSchema);
      // Auto-load tables for the first schema
      const firstSchemaObj = schemas.find((s) => s.name === firstSchema);
      if (firstSchemaObj && !firstSchemaObj.tables) {
        loadTables(firstSchema).catch(console.error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemas.length]);

  const checkConnection = async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/db/status");
      const data = await response.json();
      return data.connected === true;
    } catch {
      return false;
    }
  };

  const loadSchemas = async (retryCount = 0) => {
    setLoading(true);
    try {
      // First check if connection is ready, and reconnect if needed
      if (retryCount === 0) {
        const isConnected = await checkConnection();
        if (!isConnected) {
          // Try to reconnect by calling connect API
          if (connectionId) {
            const conn = getConnection(connectionId);
            if (conn) {
              try {
                await fetch("/api/db/connect", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(conn),
                });
                // Wait a bit for connection to establish
                await new Promise((resolve) => setTimeout(resolve, 300));
              } catch (reconnectError) {
                console.error("Failed to reconnect:", reconnectError);
              }
            }
          }
          
          if (retryCount < 5) {
            setTimeout(() => {
              loadSchemas(retryCount + 1);
            }, 500);
            return;
          }
        }
      }

      const response = await fetch("/api/db/schema");
      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || "Failed to load schemas";
        // If connection issue, retry or return empty
        if (
          errorMsg.includes("Not connected") || 
          errorMsg.includes("No database connection") ||
          errorMsg.includes("closed") ||
          errorMsg.includes("not queryable")
        ) {
          // Retry up to 5 times if connection isn't ready yet
          if (retryCount < 5) {
            setTimeout(() => {
              loadSchemas(retryCount + 1);
            }, 500);
            return;
          }
          setSchemas([]);
          return;
        }
        throw new Error(errorMsg);
      }

      if (data.error) {
        const errorMsg = data.error;
        // Retry if error suggests connection issue
        if (
          retryCount < 5 && (
            errorMsg.includes("connection") ||
            errorMsg.includes("closed") ||
            errorMsg.includes("not queryable") ||
            errorMsg.includes("Connection terminated") ||
            errorMsg.includes("terminated")
          )
        ) {
          setTimeout(() => {
            loadSchemas(retryCount + 1);
          }, 500);
          return;
        }
        setSchemas([]);
        return;
      }

      const schemasList = data.schemas || [];
      if (schemasList.length === 0 && retryCount < 3) {
        // Retry a few more times if we got empty schemas (might be timing issue)
        setTimeout(() => {
          loadSchemas(retryCount + 1);
        }, 500);
        return;
      }

      // Preserve existing tables data when updating schemas
      setSchemas((prevSchemas) => {
        const existingTablesMap = new Map(
          prevSchemas.map((s) => [s.name, s.tables])
        );
        
        // Sort schemas to ensure "public" is always first
        const sortedSchemasList = [...schemasList].sort((a, b) => {
          if (a === "public") return -1;
          if (b === "public") return 1;
          return a.localeCompare(b);
        });
        
        const newSchemas = sortedSchemasList.map((name: string) => ({
          name,
          tables: existingTablesMap.get(name), // Preserve existing tables if available
        }));
        
        // Auto-load tables for the first schema (or selected schema) if not already loaded
        if (newSchemas.length > 0) {
          const schemaToLoad = selectedSchema && sortedSchemasList.includes(selectedSchema) 
            ? selectedSchema 
            : newSchemas[0].name;
          
          const targetSchema = newSchemas.find((s) => s.name === schemaToLoad);
          if (targetSchema && !targetSchema.tables) {
            // Use setTimeout to avoid state update during render
            setTimeout(() => {
              loadTables(schemaToLoad);
            }, 0);
          }
        }
        
        return newSchemas;
      });
    } catch (error) {
      console.error("Failed to load schemas:", error);
      // Retry on network errors
      if (retryCount < 3) {
        setTimeout(() => {
          loadSchemas(retryCount + 1);
        }, 500);
        return;
      }
      setSchemas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSchemaSelect = async (schemaName: string) => {
    setSelectedSchema(schemaName);
    // Load tables if not already loaded
    const schema = schemas.find((s) => s.name === schemaName);
    if (schema && !schema.tables) {
      await loadTables(schemaName);
    }
  };

  const loadTables = async (schemaName: string, showLoading = false) => {
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
  };

  // Filter tables based on search
  const filteredSchemas = useMemo(() => {
    if (!tableSearchTerm.trim()) return schemas;
    
    const searchLower = tableSearchTerm.toLowerCase();
    return schemas.map((schema) => {
      if (!schema.tables) return schema;
      const filteredTables = schema.tables.filter((table) =>
        table.name.toLowerCase().includes(searchLower)
      );
      return { ...schema, tables: filteredTables };
    }).filter((schema) => {
      // Show schema if it has matching tables or schema name matches
      return schema.tables && schema.tables.length > 0 || 
             schema.name.toLowerCase().includes(searchLower);
    });
  }, [schemas, tableSearchTerm]);

  // Filter schemas for selector (with search functionality)
  const filteredSchemasForSelector = useMemo(() => {
    // Sort schemas to ensure "public" is always first
    const sortedSchemas = [...schemas].sort((a, b) => {
      if (a.name === "public") return -1;
      if (b.name === "public") return 1;
      return a.name.localeCompare(b.name);
    });
    
    // If there's a search term, filter
    if (!schemaSearchTerm || schemaSearchTerm.trim() === "") return sortedSchemas;
    
    const searchLower = schemaSearchTerm.toLowerCase();
    return sortedSchemas.filter((s) => s.name.toLowerCase().includes(searchLower));
  }, [schemas, schemaSearchTerm]);

  if (!connectionId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Connect to a database to view schemas
      </div>
    );
  }

  if (loading && schemas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <div className="text-sm text-muted-foreground">Loading schemas...</div>
      </div>
    );
  }

  if (!loading && schemas.length === 0) {
    return (
      <div className="p-4 space-y-2">
        <div className="text-sm text-muted-foreground">No schemas found</div>
        <button
          onClick={() => loadSchemas()}
          className="text-xs text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const handleCreateSchema = async () => {
    if (!newSchemaName.trim() || !connectionId) return;
    
    try {
      const createResponse = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `CREATE SCHEMA IF NOT EXISTS "${newSchemaName.trim()}"` }),
      });

      const createData = await createResponse.json();
      if (!createResponse.ok || !createData.success) {
        toast.error("Failed to create schema", {
          description: createData.error || "Unknown error",
        });
        return;
      }

      toast.success("Schema created successfully");
      setShowCreateSchemaDialog(false);
      const createdSchemaName = newSchemaName.trim();
      setNewSchemaName("");
      
      // Manually reload schemas to preserve existing state
      try {
        const schemaResponse = await fetch("/api/db/schema");
        const schemaData = await schemaResponse.json();
        
        if (schemaData.schemas && Array.isArray(schemaData.schemas)) {
          // Preserve existing tables data when updating schemas
          setSchemas((prevSchemas) => {
            const existingTablesMap = new Map(
              prevSchemas.map((s) => [s.name, s.tables])
            );
            
            // Sort schemas to ensure "public" is always first
            const sortedSchemasList = [...schemaData.schemas].sort((a, b) => {
              if (a === "public") return -1;
              if (b === "public") return 1;
              return a.localeCompare(b);
            });
            
            const newSchemas = sortedSchemasList.map((name: string) => ({
              name,
              tables: existingTablesMap.get(name), // Preserve existing tables if available
            }));
            
            return newSchemas;
          });
          
          // Select the newly created schema and load its tables
          if (schemaData.schemas.includes(createdSchemaName)) {
            setSelectedSchema(createdSchemaName);
            // Load tables for the new schema
            setTimeout(() => {
              loadTables(createdSchemaName).catch(console.error);
            }, 100);
          }
        }
      } catch (error) {
        console.error("Failed to reload schemas after creation:", error);
        // Fallback to full reload
        loadSchemas();
      }
    } catch (error) {
      toast.error("Failed to create schema", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
      <div className="space-y-2">
        {/* Schema Selector and Search */}
        <div className="px-2 space-y-2">
          {/* Schema Selector */}
          {!isMongoDB && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between h-8 text-sm">
                  <span>
                    {selectedSchema || "Select schema"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Search schemas..."
                    value={schemaSearchTerm}
                    onChange={(e) => setSchemaSearchTerm(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {filteredSchemasForSelector.map((schema) => (
                    <button
                      key={schema.name}
                      onClick={() => {
                        handleSchemaSelect(schema.name);
                        setSchemaSearchTerm(""); // Clear search when selecting
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                        selectedSchema === schema.name && "bg-accent"
                      )}
                    >
                      {schema.name}
                    </button>
                  ))}
                  {/* Create Schema Option */}
                  <div className="border-t p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8 text-sm"
                      onClick={() => {
                        setShowCreateSchemaDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Schema
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Table Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tables..."
              value={tableSearchTerm}
              onChange={(e) => setTableSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Tables List */}
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
                        className={cn(
                          "h-6 w-6 hover:text-foreground",
                          isRefreshingTables && "text-muted-foreground opacity-50"
                        )}
                        disabled={isRefreshingTables}
                        onClick={() => {
                          if (selectedSchema) {
                            loadTables(selectedSchema, true);
                          }
                        }}
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
                <CreateTableDialog
                  schema={selectedSchema}
                  onTableCreated={() => {
                    // Reload tables after creation
                    if (selectedSchema) {
                      loadTables(selectedSchema);
                    }
                    onTableCreated?.();
                  }}
                />
              </div>
            </div>
          )}
          {selectedSchema ? (
            (() => {
              const currentSchema = filteredSchemas.find((s) => s.name === selectedSchema);
              if (!currentSchema) return null;
              
              const tablesToShow = currentSchema.tables || [];
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
                        <Table className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1 text-left">{table.name}</span>
                        {table.rowCount !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {table.rowCount.toLocaleString()}
                          </span>
                        )}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.stopPropagation();
                              // Load table columns
                              try {
                                const response = await fetch(`/api/db/schema?schema=${encodeURIComponent(table.schema)}`);
                                const data = await response.json();
                                const tableInfo = data.tables?.find((t: any) => t.name === table.name);
                                if (tableInfo) {
                                  // Fetch columns
                                  const colsResponse = await fetch("/api/db/query", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      query: `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
                                      params: [table.schema, table.name],
                                    }),
                                  });
                                  const colsData = await colsResponse.json();
                                  const cols = colsData.success
                                    ? colsData.data.rows.map((r: any) => ({
                                        name: r.column_name,
                                        dataType: r.data_type,
                                        isNullable: r.is_nullable === "YES",
                                        defaultValue: r.column_default,
                                        characterMaximumLength: r.character_maximum_length,
                                      }))
                                    : [];
                                  setEditingTable({ schema: table.schema, table: table.name, columns: cols });
                                  setShowEditTableDialog(true);
                                }
                              } catch (error) {
                                toast.error("Failed to load table info", {
                                  description: error instanceof Error ? error.message : "Unknown error",
                                });
                              }
                            }}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit Table
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingTable({ schema: table.schema, table: table.name });
                              setShowDeleteConfirm(true);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Table
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                  {filteredTables.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      {tableSearchTerm ? "No tables found" : (isMongoDB ? "No collections" : "No tables")}
                    </div>
                  )}
                </div>
              );
            })()
          ) : isMongoDB ? (
            // MongoDB: show all collections from all schemas
            filteredSchemas.map((schema) => (
              schema.tables?.map((table) => (
                <button
                  key={`${table.schema}.${table.name}`}
                  onClick={() => onTableSelect?.(table.schema, table.name)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Table className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left">{table.name}</span>
                  {table.rowCount !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {table.rowCount.toLocaleString()}
                    </span>
                  )}
                </button>
              ))
            ))
          ) : (
            <div className="px-2 py-1 text-sm text-muted-foreground">
              Select a schema to view tables
            </div>
          )}
        </div>

      {/* Create Schema Dialog */}
      {!isMongoDB && (
        <Dialog open={showCreateSchemaDialog} onOpenChange={setShowCreateSchemaDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Schema</DialogTitle>
              <DialogDescription>
                Create a new database schema
              </DialogDescription>
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
              <Button onClick={handleCreateSchema} disabled={!newSchemaName.trim()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Table Dialog */}
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

      {/* Schema Change Preview Dialog */}
      <SchemaChangePreviewDialog
        open={showSchemaChangePreview}
        onOpenChange={setShowSchemaChangePreview}
        changes={pendingSchemaChanges}
        onConfirm={async () => {
          // Apply all schema changes
          for (const change of pendingSchemaChanges) {
            for (const query of change.queries) {
              const response = await fetch("/api/db/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
              });
              const data = await response.json();
              if (!response.ok || !data.success) {
                throw new Error(data.error || `Failed to apply change: ${change.description}`);
              }
            }
          }
          // Clear staged changes
          schemaChangeStager.clearChanges();
          setPendingSchemaChanges([]);
          // Reload tables
          if (selectedSchema) {
            loadTables(selectedSchema);
          }
          toast.success("Schema changes applied successfully");
        }}
        onCancel={() => {
          // Clear staged changes
          schemaChangeStager.clearChanges();
          setPendingSchemaChanges([]);
        }}
      />

      {/* Delete Table Confirmation */}
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Table"
        description={`Are you sure you want to delete table "${deletingTable?.schema}.${deletingTable?.table}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={async () => {
          if (!deletingTable) return;
          
          try {
            const query = `DROP TABLE "${deletingTable.schema}"."${deletingTable.table}" CASCADE`;
            const response = await fetch("/api/db/query", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query }),
            });
            
            const data = await response.json();
            if (!response.ok || !data.success) {
              toast.error("Failed to delete table", {
                description: data.error || "Unknown error",
              });
              return;
            }
            
            toast.success("Table deleted successfully");
            setShowDeleteConfirm(false);
            setDeletingTable(null);
            // Reload tables
            if (selectedSchema) {
              loadTables(selectedSchema);
            }
          } catch (error) {
            toast.error("Failed to delete table", {
              description: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }}
      />
    </div>
  );
}
