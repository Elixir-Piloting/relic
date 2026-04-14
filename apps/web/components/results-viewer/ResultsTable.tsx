"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueryResult } from "./types";

interface ResultsTableProps {
  result: QueryResult;
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
  enableCRUD?: boolean;
  primaryKeys?: string[];
  schema?: string;
  table?: string;
  onSort: (column: string) => void;
  onCopyCell: (value: any) => void;
  onCopyRow: (row: any) => void;
  onCellDoubleClick: (rowIndex: number, field: string) => void;
  onRowEdit: (row: any) => void;
  onRowDelete: (row: any) => void;
}

export function ResultsTable({
  result,
  sortColumn,
  sortDirection,
  page,
  pageSize,
  enableCRUD,
  primaryKeys,
  schema,
  table,
  onSort,
  onCopyCell,
  onCopyRow,
  onCellDoubleClick,
  onRowEdit,
  onRowDelete,
}: ResultsTableProps) {
  let sortedRows = useMemo(() => {
    if (!sortColumn) return result.rows;

    return [...result.rows].sort((a, b) => {
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
  }, [result.rows, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedRows.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedRows = sortedRows.slice(startIndex, startIndex + pageSize);

  const getPrimaryKeyFilter = (row: any) => {
    if (!primaryKeys || primaryKeys.length === 0) return null;
    return primaryKeys.map((pk) => `${pk}=${row[pk]}`).join(", ");
  };

  return (
    <div className="flex-1 overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            {result.fields.map((field) => (
              <TableHead
                key={field.name}
                className={cn(
                  "cursor-pointer select-none",
                  sortColumn === field.name && "text-primary"
                )}
                onClick={() => onSort(field.name)}
              >
                <div className="flex items-center gap-1">
                  <span>{field.name}</span>
                  {sortColumn === field.name && (
                    <span className="text-xs">
                      {sortDirection === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
              </TableHead>
            ))}
            {enableCRUD && <TableHead className="w-[100px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedRows.map((row, rowIndex) => {
            const rowPrimaryKey = getPrimaryKeyFilter(row);
            const actualIndex = startIndex + rowIndex;

            return (
              <TableRow key={rowPrimaryKey || actualIndex}>
                {result.fields.map((field) => {
                  const value = row[field.name];
                  const isNull = value === null;

                  return (
                    <TableCell
                      key={field.name}
                      className={cn(
                        "max-w-[300px] truncate cursor-pointer",
                        isNull && "text-muted-foreground italic"
                      )}
                      onDoubleClick={() =>
                        onCellDoubleClick(actualIndex, field.name)
                      }
                      onClick={() => onCopyCell(value)}
                      title={isNull ? "NULL" : String(value)}
                    >
                      {isNull ? "NULL" : String(value)}
                    </TableCell>
                  );
                })}
                {enableCRUD && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onRowEdit(row)}
                        title="Edit row"
                      >
                        <span className="text-xs">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => onRowDelete(row)}
                        title="Delete row"
                      >
                        <span className="text-xs">Del</span>
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}