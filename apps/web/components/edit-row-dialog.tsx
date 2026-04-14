"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ColumnInfo } from "@/lib/db/types";

interface EditRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: Record<string, any> | null;
  columns: ColumnInfo[];
  primaryKeys: string[];
  schema: string;
  table: string;
  onSave: (newRow: Record<string, any>) => void;
}

export function EditRowDialog({
  open,
  onOpenChange,
  row,
  columns,
  primaryKeys,
  schema,
  table,
  onSave,
}: EditRowDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (row) {
      setFormData({ ...row });
    }
  }, [row]);

  const handleSave = async () => {
    if (!row) return;

    setIsSaving(true);
    try {
      let paramIndex = 1;
      const whereConditions: string[] = [];
      const setClauses: string[] = [];
      const params: any[] = [];

      // Build WHERE clause from primary keys
      primaryKeys.forEach((pk) => {
        const value = row[pk];
        if (value === null || value === undefined) {
          whereConditions.push(`"${pk}" IS NULL`);
        } else {
          whereConditions.push(`"${pk}" = $${paramIndex++}`);
          params.push(value);
        }
      });

      // Build SET clauses for changed values
      columns.forEach((col) => {
        const oldValue = row[col.name];
        const newValue = formData[col.name];

        // Skip if value hasn't changed
        if (oldValue === newValue) return;
        // Skip primary keys (can't be updated)
        if (primaryKeys.includes(col.name)) return;

        if (newValue === null || newValue === "") {
          if (col.isNullable) {
            setClauses.push(`"${col.name}" = $${paramIndex++}`);
            params.push(null);
          }
        } else {
          setClauses.push(`"${col.name}" = $${paramIndex++}`);
          params.push(newValue);
        }
      });

      if (setClauses.length === 0) {
        toast.info("No changes to save");
        onOpenChange(false);
        return;
      }

      const query = `UPDATE "${schema}"."${table}" SET ${setClauses.join(", ")} WHERE ${whereConditions.join(" AND ")}`;

      const response = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, params }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.error("Failed to update row", {
          description: data.error || "Unknown error",
        });
        return;
      }

      toast.success("Changes staged");
      onSave(formData);
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update row", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Row</DialogTitle>
          <DialogDescription>
            Modify the row values. Primary key fields cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {columns.map((col) => {
            const value = formData[col.name];
            const isPrimaryKey = primaryKeys.includes(col.name);
            const isReadOnly = isPrimaryKey;

            return (
              <div key={col.name} className="grid gap-2">
                <Label htmlFor={col.name}>
                  {col.name}
                  {isPrimaryKey && (
                    <span className="text-xs text-muted-foreground ml-1">(Primary Key)</span>
                  )}
                  <span className="text-xs text-muted-foreground ml-2">({col.dataType})</span>
                </Label>
                <Input
                  id={col.name}
                  type={col.dataType.includes("int") || col.dataType.includes("numeric") ? "number" : "text"}
                  value={value === null || value === undefined ? "" : String(value)}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    if (newValue === "") {
                      setFormData({ ...formData, [col.name]: col.isNullable ? null : undefined });
                    } else {
                      setFormData({ ...formData, [col.name]: newValue });
                    }
                  }}
                  disabled={isReadOnly}
                  className={isReadOnly ? "bg-muted" : ""}
                />
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
