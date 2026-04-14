"use client";

import type { ConnectionConfig } from "@/lib/db/types";
import { Database, Check, MoreVertical, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConnectionListProps {
  connections: ConnectionConfig[];
  currentConnectionId?: string;
  onSelect: (config: ConnectionConfig) => void;
  onEdit: (conn: ConnectionConfig) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export function ConnectionList({
  connections,
  currentConnectionId,
  onSelect,
  onEdit,
  onDelete,
}: ConnectionListProps) {
  if (connections.length === 0) {
    return (
      <p className="px-2 text-xs text-muted-foreground">
        No connections. Click + to add one.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {connections.map((conn) => (
        <div
          key={conn.id}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors group",
            "hover:bg-accent/50",
            currentConnectionId === conn.id
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground"
          )}
        >
          <button
            onClick={() => onSelect(conn)}
            className="flex-1 flex items-center gap-2 text-left min-w-0"
          >
            <Database className="h-4 w-4 shrink-0" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-32 text-wrap line-clamp-1">{conn.name}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{conn.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {currentConnectionId === conn.id && (
              <Check className="h-4 w-4 shrink-0" />
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-6 w-6 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded hover:bg-accent transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onEdit(conn)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  onDelete(conn.id, e);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}