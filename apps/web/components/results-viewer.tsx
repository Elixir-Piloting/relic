"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, ChevronLeft, ChevronRight, Edit, Trash2, Plus, FileJson, Table as TableIcon, AlertTriangle, Check, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChangePreviewDialog } from "@/components/change-preview-dialog";
import { changeStager, type PendingChange } from "@/lib/query/change-stager";
import { cn } from "@/lib/utils";
import { EditRowDialog } from "@/components/edit-row-dialog";
import { InsertRowDialog } from "@/components/insert-row-dialog";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import type { ColumnInfo } from "@/lib/db/types";
import { DatabaseProvider } from "@/lib/db/providers";

interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: Array<{ name: string; dataTypeID: number }>;
}

interface ResultsViewerProps {
  result: QueryResult | null;
  error: string | null;
  loading?: boolean;
  schema?: string;
  table?: string;
  columns?: ColumnInfo[];
  primaryKeys?: string[];
  onRefresh?: () => void;
  enableCRUD?: boolean;
  provider?: DatabaseProvider; // Pass provider as prop to avoid server-side imports
}

const ITEMS_PER_PAGE = 500;
const PAGE_SIZE_OPTIONS = [50, 100, 250, 500, 1000];

export function ResultsViewer({
  result,
  error,
  loading = false,
  schema,
  table,
  columns = [],
  primaryKeys = [],
  onRefresh,
  enableCRUD = false,
  provider,
}: ResultsViewerProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null);
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInsertDialogOpen, setIsInsertDialogOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<Record<string, any> | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [showChangePreview, setShowChangePreview] = useState(false);
  const [stagedEdits, setStagedEdits] = useState<Map<string, any>>(new Map()); // row key -> new values
  
  // Check if this is MongoDB
  const isMongoDB = provider === DatabaseProvider.MONGODB;

  useEffect(() => {
    setPage(1); // Reset to first page when page size changes
  }, [pageSize]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Executing query...
      </div>
    );
  }

  if (error) {
    const isConnectionError = error.includes("No database connection") || error.includes("Please connect first");
    
    if (isConnectionError) {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="max-w-md w-full">
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-600 dark:text-yellow-400">
                <div className="font-medium mb-1">Not Connected</div>
                <div className="text-sm">Please connect to a database to view table data.</div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }
    
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
        <div className="font-medium mb-1">Error</div>
        <div className="font-mono text-xs">{error}</div>
      </div>
    );
  }

  if (!result || result.rows.length === 0) {
    return (
      <div className="w-full border border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-md p-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {result?.rowCount === 0
              ? "This table contains no rows or data"
              : "No results to display"}
          </span>
        </div>
      </div>
    );
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const copyCell = (value: any) => {
    const text = value === null ? "NULL" : String(value);
    navigator.clipboard.writeText(text);
  };

  const copyRow = (row: any) => {
    const text = result.fields.map((f) => row[f.name] ?? "NULL").join("\t");
    navigator.clipboard.writeText(text);
  };

  const copyJSON = (row: any) => {
    navigator.clipboard.writeText(JSON.stringify(row, null, 2));
  };

  const handleCellDoubleClick = (rowIndex: number, field: string) => {
    if (!enableCRUD || !schema || !table || primaryKeys.length === 0) return;
    setEditingCell({ rowIndex, field });
  };

  const handleCellEdit = async (row: any, field: string, newValue: any) => {
    if (!schema || !table || primaryKeys.length === 0) return;

    try {
      let paramIndex = 1;
      const whereConditions: string[] = [];
      const params: any[] = [];

      primaryKeys.forEach((pk) => {
        const value = row[pk];
        if (value === null || value === undefined) {
          whereConditions.push(`"${pk}" IS NULL`);
        } else {
          whereConditions.push(`"${pk}" = $${paramIndex++}`);
          params.push(value);
        }
      });

      params.push(newValue === "" ? null : newValue);
      const query = `UPDATE "${schema}"."${table}" SET "${field}" = $${paramIndex} WHERE ${whereConditions.join(" AND ")}`;

      const response = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, params }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.error("Failed to update cell", {
          description: data.error || "Unknown error",
        });
        return;
      }

      toast.success("Cell updated successfully");
      onRefresh?.();
    } catch (error) {
      toast.error("Failed to update cell", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setEditingCell(null);
    }
  };

  const handleEdit = (row: any) => {
    setEditingRow(row);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (row: any) => {
    if (!schema || !table || primaryKeys.length === 0) return;
    
    setDeletingRow(row);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deletingRow || !schema || !table || primaryKeys.length === 0) return;
    
    let query: string;
    let params: any[] = [];

    if (isMongoDB) {
      // MongoDB delete syntax: db.collection.deleteOne({_id: ...})
      const filter: Record<string, any> = {};
      primaryKeys.forEach((pk) => {
        filter[pk] = deletingRow[pk];
      });
      query = `db.${table}.deleteOne(${JSON.stringify(filter)})`;
    } else {
      // SQL delete syntax
      let paramIndex = 1;
      const whereConditions: string[] = [];

      primaryKeys.forEach((pk) => {
        const value = deletingRow[pk];
        if (value === null || value === undefined) {
          whereConditions.push(`"${pk}" IS NULL`);
        } else {
          whereConditions.push(`"${pk}" = $${paramIndex++}`);
          params.push(value);
        }
      });

      query = `DELETE FROM "${schema}"."${table}" WHERE ${whereConditions.join(" AND ")}`;
    }

    changeStager.stageDelete(schema, table, deletingRow, primaryKeys, query, params);
    
    // Update pending changes
    const changes = changeStager.getChangesForTable(schema, table);
    setPendingChanges(changes);
    
    toast.success("Delete staged", {
      description: "Review all changes before applying them.",
    });
    
    setIsDeleteDialogOpen(false);
    setDeletingRow(null);
  };

  const handleApplyChanges = async () => {
    if (!schema || !table) return;
    
    const changes = changeStager.getChangesForTable(schema, table);
    if (changes.length === 0) return;

    try {
      // Apply all changes in order
      for (const change of changes) {
        const response = await fetch("/api/db/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: change.query, params: change.params }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || `Failed to apply ${change.type} change`);
        }
      }

      // Clear staged changes
      changeStager.clearChangesForTable(schema, table);
      setPendingChanges([]);
      setStagedEdits(new Map());
      
      toast.success(`Applied ${changes.length} change${changes.length !== 1 ? "s" : ""} successfully`);
      onRefresh?.();
    } catch (error) {
      toast.error("Failed to apply changes", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  };

  const handleDiscardChanges = () => {
    if (!schema || !table) return;
    changeStager.clearChangesForTable(schema, table);
    setPendingChanges([]);
    setStagedEdits(new Map());
    toast.info("Changes discarded");
  };


  // Sort rows
  let sortedRows = [...result.rows];
  if (sortColumn) {
    sortedRows.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      const comparison =
        aVal === null && bVal === null
          ? 0
          : aVal === null
          ? 1
          : bVal === null
          ? -1
          : aVal < bVal
          ? -1
          : aVal > bVal
          ? 1
          : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }

  // Paginate
  const totalPages = Math.ceil(sortedRows.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedRows = sortedRows.slice(
    startIndex,
    startIndex + pageSize
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border border-border bg-muted/30 rounded-t-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {result.rowCount.toLocaleString()} {isMongoDB ? "document" : "row"}{result.rowCount !== 1 ? "s" : ""}
              {totalPages > 1 && ` • Page ${page} of ${totalPages}`}
            </div>
            {isMongoDB && (
              <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
                <Button
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="h-7 px-2"
                >
                  <TableIcon className="h-3.5 w-3.5 mr-1.5" />
                  Table
                </Button>
                <Button
                  variant={viewMode === "json" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("json")}
                  className="h-7 px-2"
                >
                  <FileJson className="h-3.5 w-3.5 mr-1.5" />
                  JSON
                </Button>
              </div>
            )}
            {enableCRUD && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInsertDialogOpen(true)}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Row
              </Button>
            )}
          </div>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="text-xs px-2 py-1 rounded-md border border-border bg-background text-foreground"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="h-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="h-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {isMongoDB && viewMode === "json" ? (
          <div className="p-4 space-y-2">
            {paginatedRows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className="border border-border rounded-md p-3 bg-muted/20"
              >
                <pre className="text-xs font-mono overflow-x-auto">
                  {JSON.stringify(row, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              {result.fields.map((field) => (
                <TableHead
                  key={field.name}
                  className="cursor-pointer select-none hover:bg-accent/50"
                  onClick={() => handleSort(field.name)}
                >
                  <div className="flex items-center gap-2">
                    {field.name}
                    {sortColumn === field.name && (
                      <span className="text-xs">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
                  {paginatedRows.map((row, rowIndex) => {
                    const actualRowIndex = startIndex + rowIndex;
                    // Get staged edits for this row
                    const rowKey = primaryKeys.map((pk) => `${pk}:${row[pk]}`).join("|");
                    const stagedRow = stagedEdits.get(rowKey);
                    const displayRow = stagedRow || row;
                    const hasStagedChanges = stagedRow !== undefined;
                    
                    // Check if this row is staged for deletion
                    const isStagedForDelete = pendingChanges.some(
                      (c) => c.type === "DELETE" && 
                        primaryKeys.every((pk) => c.originalRow?.[pk] === row[pk])
                    );
                    
                    if (isStagedForDelete) {
                      return (
                        <TableRow 
                          key={actualRowIndex} 
                          className="group bg-red-500/10 opacity-50"
                        >
                          {result.fields.map((field) => (
                            <TableCell key={field.name} className="font-mono text-xs line-through">
                              {row[field.name] === null || row[field.name] === undefined 
                                ? "NULL" 
                                : String(row[field.name])}
                            </TableCell>
                          ))}
                          <TableCell className="w-0">
                            <Badge variant="destructive" className="text-xs">Staged for deletion</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    return (
                      <TableRow 
                        key={actualRowIndex} 
                        className={cn("group", hasStagedChanges && "bg-blue-500/5")}
                      >
                        {result.fields.map((field) => {
                          const value = displayRow[field.name];
                          const isNull = value === null || value === undefined;
                          const isEditing = editingCell?.rowIndex === actualRowIndex && editingCell?.field === field.name;
                          const isChanged = stagedRow && stagedRow[field.name] !== row[field.name];

                          return (
                            <TableCell
                        key={field.name}
                        className={cn(
                          "font-mono text-xs max-w-[200px]",
                          isNull && "text-muted-foreground italic",
                          enableCRUD && !primaryKeys.includes(field.name) && "cursor-pointer hover:bg-accent/50",
                          isChanged && "bg-blue-500/10 border border-blue-500/20"
                        )}
                        title={isNull ? "NULL" : String(value)}
                        onDoubleClick={() => handleCellDoubleClick(actualRowIndex, field.name)}
                      >
                        {isEditing ? (
                          <Input
                            defaultValue={isNull ? "" : String(value)}
                            className="h-6 text-xs font-mono"
                            autoFocus
                            onBlur={(e) => {
                              const newValue = e.target.value;
                              handleCellEdit(row, field.name, newValue);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const newValue = e.currentTarget.value;
                                handleCellEdit(row, field.name, newValue);
                              } else if (e.key === "Escape") {
                                setEditingCell(null);
                              }
                            }}
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="flex-1 truncate">
                              {isNull ? "NULL" : String(value)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100"
                              onClick={() => copyCell(value)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                            </TableCell>
                          );
                        })}
                      <TableCell className="w-0">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      {enableCRUD && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(row)}
                            title="Edit row"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(row)}
                            title="Delete row"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyRow(row)}
                        title="Copy row (tab-separated)"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyJSON(row)}
                        title="Copy as JSON"
                      >
                        JSON
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        )}
      </div>

      {/* CRUD Dialogs */}
      {enableCRUD && schema && table && (
        <>
          <EditRowDialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open);
              if (!open) setEditingRow(null);
            }}
            row={editingRow}
            columns={columns}
            primaryKeys={primaryKeys}
            schema={schema}
            table={table}
            onSave={(newRow) => {
              // Stage the edit
              if (editingRow && schema && table) {
                const rowKey = primaryKeys.map((pk) => `${pk}:${editingRow[pk]}`).join("|");
                setStagedEdits(new Map(stagedEdits.set(rowKey, newRow)));
                
                let query: string;
                let params: any[] = [];

                if (isMongoDB) {
                  // MongoDB update syntax: db.collection.updateOne({_id: ...}, {$set: {...}})
                  const filter: Record<string, any> = {};
                  primaryKeys.forEach((pk) => {
                    filter[pk] = editingRow[pk];
                  });

                  const update: Record<string, any> = {};
                  columns.forEach((col) => {
                    const oldValue = editingRow[col.name];
                    const newValue = newRow[col.name];
                    if (oldValue !== newValue && !primaryKeys.includes(col.name)) {
                      update[col.name] = newValue === null || newValue === "" ? null : newValue;
                    }
                  });

                  if (Object.keys(update).length > 0) {
                    query = `db.${table}.updateOne(${JSON.stringify(filter)}, {$set: ${JSON.stringify(update)}})`;
                  } else {
                    setEditingRow(null);
                    return;
                  }
                } else {
                  // SQL update syntax
                  let paramIndex = 1;
                  const whereConditions: string[] = [];
                  const setClauses: string[] = [];

                  primaryKeys.forEach((pk) => {
                    const value = editingRow[pk];
                    if (value === null || value === undefined) {
                      whereConditions.push(`"${pk}" IS NULL`);
                    } else {
                      whereConditions.push(`"${pk}" = $${paramIndex++}`);
                      params.push(value);
                    }
                  });

                  columns.forEach((col) => {
                    const oldValue = editingRow[col.name];
                    const newValue = newRow[col.name];
                    if (oldValue !== newValue && !primaryKeys.includes(col.name)) {
                      setClauses.push(`"${col.name}" = $${paramIndex++}`);
                      params.push(newValue === null || newValue === "" ? null : newValue);
                    }
                  });

                  if (setClauses.length > 0) {
                    query = `UPDATE "${schema}"."${table}" SET ${setClauses.join(", ")} WHERE ${whereConditions.join(" AND ")}`;
                  } else {
                    setEditingRow(null);
                    return;
                  }
                }

                changeStager.stageUpdate(schema, table, editingRow, newRow, primaryKeys, query, params);
                const changes = changeStager.getChangesForTable(schema, table);
                setPendingChanges(changes);
              }
              setEditingRow(null);
            }}
          />
          <InsertRowDialog
            open={isInsertDialogOpen}
            onOpenChange={setIsInsertDialogOpen}
            columns={columns}
            schema={schema}
            table={table}
            onSave={(newRow) => {
              // Update pending changes
              if (schema && table) {
                const changes = changeStager.getChangesForTable(schema, table);
                setPendingChanges(changes);
              }
            }}
          />
          <ConfirmationDialog
            open={isDeleteDialogOpen}
            onOpenChange={(open) => {
              setIsDeleteDialogOpen(open);
              if (!open) {
                // Remove the staged delete when dialog closes
                if (deletingRow && schema && table && primaryKeys.length > 0) {
                  const changes = changeStager.getChangesForTable(schema, table);
                  const deleteChange = changes.find((c) => c.type === "DELETE" && c.originalRow === deletingRow);
                  if (deleteChange) {
                    changeStager.removeChange(deleteChange.id);
                    const updatedChanges = changeStager.getChangesForTable(schema, table);
                    setPendingChanges(updatedChanges);
                  }
                }
                setDeletingRow(null);
              }
            }}
            title="Delete Row"
            description="This delete will be staged. You can review all changes before applying them."
            confirmText="Stage Delete"
            cancelText="Cancel"
            variant="destructive"
            onConfirm={handleDeleteConfirm}
          />
        </>
      )}

      {/* Change Preview Dialog */}
      {pendingChanges.length > 0 && (
        <ChangePreviewDialog
          open={showChangePreview}
          onOpenChange={setShowChangePreview}
          changes={pendingChanges}
          onConfirm={handleApplyChanges}
          onCancel={handleDiscardChanges}
        />
      )}
    </div>
  );
}
