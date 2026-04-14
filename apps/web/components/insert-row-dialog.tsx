"use client";

import { useState } from "react";
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

interface InsertRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnInfo[];
  schema: string;
  table: string;
  onSave: (newRow?: Record<string, any>) => void;
}

export function InsertRowDialog({
  open,
  onOpenChange,
  columns,
  schema,
  table,
  onSave,
}: InsertRowDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    // Validate required fields
    const requiredColumns = columns.filter((col) => !col.isNullable && !col.defaultValue);
    for (const col of requiredColumns) {
      if (formData[col.name] === undefined || formData[col.name] === null || formData[col.name] === "") {
        toast.error("Validation error", {
          description: `Field "${col.name}" is required`,
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const columnNames: string[] = [];
      const values: any[] = [];
      const placeholders: string[] = [];

      columns.forEach((col, idx) => {
        const value = formData[col.name];
        // Skip if value is not provided and column has default or is nullable
        if (value === undefined && (col.defaultValue || col.isNullable)) {
          return;
        }
        // Skip if value is null and column is not nullable and no default
        if (value === null && !col.isNullable && !col.defaultValue) {
          return;
        }

        columnNames.push(`"${col.name}"`);
        if (value === null || value === "") {
          values.push(null);
        } else {
          values.push(value);
        }
        placeholders.push(`$${idx + 1}`);
      });

      if (columnNames.length === 0) {
        toast.error("No values provided");
        return;
      }

      const query = `INSERT INTO "${schema}"."${table}" (${columnNames.join(", ")}) VALUES (${placeholders.join(", ")})`;

      // Stage the insert instead of executing immediately
      const { changeStager } = await import("@/lib/query/change-stager");
      changeStager.stageInsert(schema, table, { ...formData }, query, values);
      
      toast.success("Insert staged");
      setFormData({});
      onSave({ ...formData });
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to insert row", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Insert New Row</DialogTitle>
          <DialogDescription>
            Enter values for the new row. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {columns.map((col) => {
            const value = formData[col.name];
            const hasDefault = !!col.defaultValue;
            const isRequired = !col.isNullable && !hasDefault;

            return (
              <div key={col.name} className="grid gap-2">
                <Label htmlFor={col.name}>
                  {col.name}
                  {isRequired && <span className="text-destructive ml-1">*</span>}
                  {hasDefault && (
                    <span className="text-xs text-muted-foreground ml-1">
                      (default: {col.defaultValue})
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-2">({col.dataType})</span>
                </Label>
                <div className="flex gap-2">
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
                    placeholder={
                      hasDefault
                        ? `Default: ${col.defaultValue}`
                        : col.isNullable
                        ? "NULL (optional)"
                        : "Required"
                    }
                    required={isRequired}
                  />
                  {col.isNullable && !hasDefault && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData({ ...formData, [col.name]: null });
                      }}
                    >
                      NULL
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Inserting..." : "Insert Row"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
