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
import { Check, X, Plus, Trash2, Edit } from "lucide-react";
import type { PendingChange } from "@/lib/query/change-stager";
import { cn } from "@/lib/utils";

interface ChangePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: PendingChange[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function ChangePreviewDialog({
  open,
  onOpenChange,
  changes,
  onConfirm,
  onCancel,
}: ChangePreviewDialogProps) {
  const [isApplying, setIsApplying] = useState(false);

  const handleConfirm = async () => {
    setIsApplying(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to apply changes:", error);
    } finally {
      setIsApplying(false);
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case "INSERT":
        return <Plus className="h-4 w-4" />;
      case "DELETE":
        return <Trash2 className="h-4 w-4" />;
      case "UPDATE":
        return <Edit className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getChangeColor = (type: string) => {
    switch (type) {
      case "INSERT":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
      case "DELETE":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      case "UPDATE":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Review Changes</DialogTitle>
          <DialogDescription>
            {changes.length} change{changes.length !== 1 ? "s" : ""} pending. Review before applying.
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
                      {change.type}
                    </Badge>
                    <span className="text-sm font-medium">
                      {change.schema}.{change.table}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                </div>

                {change.type === "UPDATE" && change.originalRow && change.newRow && (
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">Changes:</div>
                    <div className="space-y-1 pl-4">
                      {Object.keys(change.newRow).map((key) => {
                        const oldValue = change.originalRow![key];
                        const newValue = change.newRow![key];
                        if (oldValue === newValue) return null;
                        return (
                          <div key={key} className="flex items-start gap-2">
                            <span className="font-mono text-xs text-muted-foreground min-w-[100px]">
                              {key}:
                            </span>
                            <div className="flex-1 space-y-1">
                              <div className="text-red-600 dark:text-red-400 line-through">
                                {oldValue === null || oldValue === undefined
                                  ? "NULL"
                                  : String(oldValue)}
                              </div>
                              <div className="text-green-600 dark:text-green-400">
                                {newValue === null || newValue === undefined
                                  ? "NULL"
                                  : String(newValue)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {change.type === "INSERT" && change.newRow && (
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">New Row:</div>
                    <div className="space-y-1 pl-4">
                      {Object.entries(change.newRow).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground min-w-[100px]">
                            {key}:
                          </span>
                          <span className="text-green-600 dark:text-green-400">
                            {value === null || value === undefined ? "NULL" : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {change.type === "DELETE" && change.originalRow && (
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">Row to Delete:</div>
                    <div className="space-y-1 pl-4">
                      {Object.entries(change.originalRow).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground min-w-[100px]">
                            {key}:
                          </span>
                          <span className="text-red-600 dark:text-red-400">
                            {value === null || value === undefined ? "NULL" : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-border/50">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View SQL
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                      {change.query}
                    </pre>
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
