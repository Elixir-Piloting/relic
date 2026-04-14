"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Shield } from "lucide-react";
import type { QueryAnalysis } from "@/lib/query/classifier";
import { QueryRisk } from "@/lib/query/classifier";

interface QueryConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  analysis: QueryAnalysis;
  onConfirm: () => void;
  onCancel: () => void;
}

const riskColors: Record<QueryRisk, string> = {
  [QueryRisk.SAFE]: "text-green-400",
  [QueryRisk.LOW]: "text-blue-400",
  [QueryRisk.MEDIUM]: "text-yellow-400",
  [QueryRisk.HIGH]: "text-orange-400",
  [QueryRisk.CRITICAL]: "text-red-400",
};

const riskLabels: Record<QueryRisk, string> = {
  [QueryRisk.SAFE]: "Safe",
  [QueryRisk.LOW]: "Low Risk",
  [QueryRisk.MEDIUM]: "Medium Risk",
  [QueryRisk.HIGH]: "High Risk",
  [QueryRisk.CRITICAL]: "Critical Risk",
};

export function QueryConfirmationDialog({
  open,
  onOpenChange,
  query,
  analysis,
  onConfirm,
  onCancel,
}: QueryConfirmationDialogProps) {
  const isHighRisk = analysis.risk === QueryRisk.HIGH || analysis.risk === QueryRisk.CRITICAL;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Confirm Destructive Query
          </DialogTitle>
          <DialogDescription>
            Safe Mode requires confirmation before executing this query.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Risk Alert */}
          <Alert variant={isHighRisk ? "destructive" : "default"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center gap-2">
                <span className="font-medium">Risk Level:</span>
                <span className={riskColors[analysis.risk]}>
                  {riskLabels[analysis.risk]}
                </span>
              </div>
            </AlertDescription>
          </Alert>

          {/* Query Preview */}
          <div>
            <h4 className="text-sm font-medium mb-2">Query:</h4>
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-40">
              {query}
            </pre>
          </div>

          {/* Analysis Summary */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Impact Summary:</h4>
            <div className="bg-muted/50 p-3 rounded-md space-y-1 text-sm">
              <div>
                <span className="font-medium">Type:</span> {analysis.type}
              </div>
              {analysis.tables.length > 0 && (
                <div>
                  <span className="font-medium">Tables:</span> {analysis.tables.join(", ")}
                </div>
              )}
              {analysis.locksExpected && analysis.locksExpected.length > 0 && (
                <div>
                  <span className="font-medium">Locks:</span> {analysis.locksExpected.join(", ")}
                </div>
              )}
              {!analysis.hasWhere && analysis.requiresWhere && (
                <div className="text-yellow-400">
                  ⚠️ No WHERE clause - may affect all rows
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={isHighRisk ? "destructive" : "default"}
            onClick={onConfirm}
            className="gap-2"
          >
            <Shield className="h-4 w-4" />
            Proceed Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
