"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Loader2, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { changeStager, type PendingChange } from "@/lib/query/change-stager";
import { cn } from "@/lib/utils";
import { DatabaseProvider } from "@/lib/db/providers";
import type { QueryResult, ResultsViewerProps } from "./types";
import { PAGE_SIZE_OPTIONS } from "./types";

function ResultsLoadingSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-50">
            <TableRow>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: 6 }).map((_, colIndex) => (
                  <TableCell key={colIndex}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

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
  page: externalPage,
  pageSize: externalPageSize,
  onPageChange: externalPageChange,
  onPageSizeChange: externalPageSizeChange,
  showPagination = true,
}: ResultsViewerProps) {
  const [internalPage, setInternalPage] = useState(1);
  const page = externalPage ?? internalPage;
  const setPage = externalPageChange ?? setInternalPage;
  const [internalPageSize, setInternalPageSize] = useState(100);
  const pageSize = externalPageSize ?? internalPageSize;
  const setPageSize = externalPageSizeChange ?? setInternalPageSize;
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<Record<string, any> | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [showChangePreview, setShowChangePreview] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [pageSizePopoverOpen, setPageSizePopoverOpen] = useState(false);

  const isMongoDB = provider === DatabaseProvider.MONGODB;

  const sortedRows = useMemo(() => {
    if (!result || !sortColumn) return result?.rows || [];
    return [...result.rows].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      const comparison = aVal === null && bVal === null ? 0 : aVal === null ? 1 : bVal === null ? -1 : aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [result, sortColumn, sortDirection]);

  useEffect(() => {
    if (!externalPage) setInternalPage(1);
  }, [pageSize, externalPage, externalPageSize]);

  useEffect(() => {
    setSelectedRows(new Set());
  }, [page, result]);

  if (loading) return <ResultsLoadingSkeleton />;

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
          <span>{result?.rowCount === 0 ? "This table contains no rows or data" : "No results to display"}</span>
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

  const handleRowEdit = (row: any) => { setEditingRow(row); setIsEditDialogOpen(true); };
  const handleRowDelete = (row: any) => { setDeletingRow(row); setIsDeleteDialogOpen(true); };

  const handleDeleteConfirm = async () => {
    if (!deletingRow || !schema || !table || primaryKeys.length === 0) return;

    let query: string;
    let params: any[] = [];

    if (isMongoDB) {
      const filter: Record<string, any> = {};
      primaryKeys.forEach((pk) => { filter[pk] = deletingRow[pk]; });
      query = `db.${table}.deleteOne(${JSON.stringify(filter)})`;
    } else {
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
    const changes = changeStager.getChangesForTable(schema, table);
    setPendingChanges(changes);
    toast.success("Delete staged", { description: "Review all changes before applying them." });
    setIsDeleteDialogOpen(false);
    setDeletingRow(null);
  };

  const handleApplyChanges = async () => {
    if (!schema || !table) return;
    const changes = changeStager.getChangesForTable(schema, table);
    if (changes.length === 0) return;

    try {
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
      changeStager.clearChangesForTable(schema, table);
      setPendingChanges([]);
      toast.success(`Applied ${changes.length} change${changes.length !== 1 ? "s" : ""} successfully`);
      onRefresh?.();
    } catch (error) {
      toast.error("Failed to apply changes", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const totalPages = Math.ceil(sortedRows.length / pageSize);
  const paginatedRows = sortedRows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  const startRow = (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, sortedRows.length);

  const toggleRowSelect = (index: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAllSelect = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(paginatedRows.map((_, i) => (page - 1) * pageSize + i)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    setPageSizePopoverOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Table area */}
      <div className="flex-1 overflow-auto" style={{ maxHeight: "100%" }}>
        <Table>
          <TableHeader className="sticky top-0 bg-card z-50 shadow-[0_1px_0_0_hsl(var(--border))]">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedRows.size === paginatedRows.length && paginatedRows.length > 0}
                  onCheckedChange={toggleAllSelect}
                />
              </TableHead>
              {result.fields.map((field) => (
                <TableHead key={field.name} className="cursor-pointer select-none" onClick={() => handleSort(field.name)}>
                  <div className="flex items-center gap-1">
                    <span>{field.name}</span>
                    {sortColumn === field.name && <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                  </div>
                </TableHead>
              ))}
              {enableCRUD && <TableHead className="w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.map((row, rowIndex) => {
              const actualIndex = (page - 1) * pageSize + rowIndex;
              const isSelected = selectedRows.has(actualIndex);
              return (
                <TableRow key={actualIndex} data-state={isSelected ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRowSelect(actualIndex)}
                    />
                  </TableCell>
                  {result.fields.map((field) => {
                    const value = row[field.name];
                    const isNull = value === null;
                    return (
                      <TableCell
                        key={field.name}
                        className={cn("max-w-[300px] truncate", isNull && "text-muted-foreground italic")}
                        onClick={() => copyCell(value)}
                      >
                        {isNull ? "NULL" : String(value)}
                      </TableCell>
                    );
                  })}
                  {enableCRUD && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRowEdit(row)}>Edit</Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRowDelete(row)}>Del</Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      {showPagination && (
      <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Left: Row info & page size */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {sortedRows.length.toLocaleString()} {isMongoDB ? "document" : "row"}{sortedRows.length !== 1 ? "s" : ""}
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
                    {pageSize}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-28 p-1" align="start">
                  <div className="flex flex-col">
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <button
                        key={size}
                        onClick={() => handlePageSizeChange(size)}
                        className={cn(
                          "flex items-center justify-between rounded-sm px-2 py-1.5 text-sm cursor-pointer transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          pageSize === size && "bg-accent text-accent-foreground font-medium"
                        )}
                      >
                        <span>{size}</span>
                        {pageSize === size && <Check className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Right: Page navigation */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground tabular-nums">
              {startRow}–{endRow} of {sortedRows.length.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">
              ({page} of {totalPages} {totalPages === 1 ? "page" : "pages"})
            </span>
            <div className="flex items-center gap-0.5 ml-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPage(1)}
                disabled={page <= 1}
                title="First page"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                title="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                title="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                title="Last page"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}