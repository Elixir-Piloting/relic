"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Check, X, Plus, Trash2, Edit2, ArrowRight, Database } from "lucide-react";
import type { SchemaChange } from "@/lib/query/schema-change-stager";
import { cn } from "@/lib/utils";

interface SchemaChangePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: SchemaChange[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function SchemaChangePreviewDialog({
  open,
  onOpenChange,
  changes,
  onConfirm,
  onCancel,
}: SchemaChangePreviewDialogProps) {
  const [isApplying, setIsApplying] = useState(false);

  const handleConfirm = async () => {
    setIsApplying(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to apply schema changes:", error);
    } finally {
      setIsApplying(false);
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case "ADD_COLUMN":
        return <Plus className="h-4 w-4" />;
      case "DROP_COLUMN":
      case "DROP_TABLE":
        return <Trash2 className="h-4 w-4" />;
      case "RENAME_COLUMN":
      case "RENAME_TABLE":
        return <ArrowRight className="h-4 w-4" />;
      case "ALTER_COLUMN":
      case "ALTER_TABLE":
        return <Edit2 className="h-4 w-4" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  const getChangeColor = (type: string) => {
    switch (type) {
      case "ADD_COLUMN":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
      case "DROP_COLUMN":
      case "DROP_TABLE":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      case "RENAME_COLUMN":
      case "RENAME_TABLE":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "ALTER_COLUMN":
      case "ALTER_TABLE":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Review Schema Changes</DialogTitle>
          <DialogDescription>
            {changes.length} schema change{changes.length !== 1 ? "s" : ""} pending. Review before applying.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {changes.map((change, index) => (
              <div
                key={change.id}
                className={cn(
                  "border rounded-lg p-4 space-y-3",
                  getChangeColor(change.type)
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getChangeIcon(change.type)}
                    <Badge variant="outline" className={getChangeColor(change.type)}>
                      {change.type.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-sm font-medium">
                      {change.schema}.{change.table}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                </div>

                <div className="text-sm">
                  <div className="font-medium mb-2">{change.description}</div>
                  
                  {change.details && (
                    <div className="space-y-1 pl-4 text-xs text-muted-foreground">
                      {change.details.oldColumnName && change.details.newColumnName && (
                        <div className="flex items-center gap-2">
                          <span className="line-through">{change.details.oldColumnName}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="text-green-600 dark:text-green-400">{change.details.newColumnName}</span>
                        </div>
                      )}
                      {change.details.oldTableName && change.details.newTableName && (
                        <div className="flex items-center gap-2">
                          <span className="line-through">{change.details.oldTableName}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="text-green-600 dark:text-green-400">{change.details.newTableName}</span>
                        </div>
                      )}
                      {change.details.columnName && (
                        <div>Column: <span className="font-mono">{change.details.columnName}</span></div>
                      )}
                      {change.details.oldType && change.details.newType && (
                        <div className="flex items-center gap-2">
                          <span className="line-through">{change.details.oldType}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="text-green-600 dark:text-green-400">{change.details.newType}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-border/50">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View SQL ({change.queries.length} query{change.queries.length !== 1 ? "ies" : "y"})
                    </summary>
                    <div className="mt-2 space-y-2">
                      {change.queries.map((query, idx) => (
                        <pre key={idx} className="p-2 bg-muted rounded text-xs overflow-x-auto">
                          {query}
                        </pre>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isApplying}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isApplying}>
            <Check className="h-4 w-4 mr-2" />
            {isApplying ? "Applying..." : `Apply ${changes.length} Change${changes.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
