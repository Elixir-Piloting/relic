"use client";

import { Table as TableIcon, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Table as TableType } from "./types";

interface TableListProps {
  tables: TableType[];
  isLoading?: boolean;
  tableSearchTerm: string;
  isMongoDB?: boolean;
  onSearchChange: (term: string) => void;
  onTableSelect: (schema: string, table: string) => void;
  onTableEdit: (schema: string, table: string, columns: any[]) => void;
  onTableDelete: (schema: string, table: string) => void;
  onRefresh?: () => void;
}

export function TableList({
  tables,
  isLoading,
  tableSearchTerm,
  isMongoDB,
  onSearchChange,
  onTableSelect,
  onTableEdit,
  onTableDelete,
  onRefresh,
}: TableListProps) {
  const filteredTables = tableSearchTerm.trim()
    ? tables.filter((table) =>
        table.name.toLowerCase().includes(tableSearchTerm.toLowerCase())
      )
    : tables;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 py-2 mb-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Tables
        </div>
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6 hover:text-foreground", isLoading && "text-muted-foreground opacity-50")}
            disabled={isLoading}
            onClick={onRefresh}
          >
            {isLoading ? (
              <span className="animate-spin h-4 w-4">↻</span>
            ) : (
              <span className="h-4 w-4">↻</span>
            )}
          </Button>
        )}
      </div>

      {filteredTables.length === 0 ? (
        <div className="px-2 py-1 text-xs text-muted-foreground">
          {tableSearchTerm ? "No tables found" : isMongoDB ? "No collections" : "No tables"}
        </div>
      ) : (
        <div className="space-y-0.5">
          {filteredTables.map((table) => (
            <div
              key={`${table.schema}.${table.name}`}
              className="group flex items-center gap-1"
            >
              <button
                onClick={() => onTableSelect(table.schema, table.name)}
                className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                <TableIcon className="h-3.5 w-3.5 shrink-0" />
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
                      try {
                        const response = await fetch(`/api/db/schema?schema=${encodeURIComponent(table.schema)}`);
                        const data = await response.json();
                        const tableInfo = data.tables?.find((t: any) => t.name === table.name);
                        if (tableInfo) {
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
                          onTableEdit(table.schema, table.name, cols);
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
                      onTableDelete(table.schema, table.name);
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
        </div>
      )}
    </div>
  );
}