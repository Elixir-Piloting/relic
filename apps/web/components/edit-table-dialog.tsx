"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Trash2, Edit2 } from "lucide-react";
import type { ColumnInfo } from "@/lib/db/types";
import { schemaChangeStager, type SchemaChange } from "@/lib/query/schema-change-stager";
import { cn } from "@/lib/utils";

const COLUMN_TYPES = [
  "VARCHAR",
  "TEXT",
  "INTEGER",
  "BIGINT",
  "SMALLINT",
  "DECIMAL",
  "NUMERIC",
  "REAL",
  "DOUBLE PRECISION",
  "BOOLEAN",
  "DATE",
  "TIME",
  "TIMESTAMP",
  "TIMESTAMPTZ",
  "UUID",
  "JSON",
  "JSONB",
];

interface ColumnEdit {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string;
  primaryKey: boolean;
  isNew?: boolean;
  isDeleted?: boolean;
  isRenamed?: boolean;
  oldName?: string;
  oldType?: string;
}

interface EditTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  onChangesStaged?: (changes: SchemaChange[]) => void;
}

export function EditTableDialog({
  open,
  onOpenChange,
  schema,
  table,
  columns,
  onChangesStaged,
}: EditTableDialogProps) {
  const [editedColumns, setEditedColumns] = useState<ColumnEdit[]>([]);
  const [pendingChanges, setPendingChanges] = useState<SchemaChange[]>([]);

  useEffect(() => {
    if (open && columns.length > 0) {
      // Initialize with existing columns
      setEditedColumns(
        columns.map((col, idx) => ({
          id: `col-${idx}`,
          name: col.name,
          type: col.dataType || "TEXT",
          nullable: col.isNullable,
          defaultValue: col.defaultValue || "",
          primaryKey: false, // We'll detect this separately
        }))
      );
      setPendingChanges([]);
    }
  }, [open, columns]);

  const addColumn = () => {
    setEditedColumns([
      ...editedColumns,
      {
        id: `new-${Date.now()}`,
        name: "",
        type: "VARCHAR",
        nullable: true,
        defaultValue: "",
        primaryKey: false,
        isNew: true,
      },
    ]);
  };

  const removeColumn = (id: string) => {
    const column = editedColumns.find((c) => c.id === id);
    if (column?.isNew) {
      // Just remove if it's new
      setEditedColumns(editedColumns.filter((c) => c.id !== id));
    } else {
      // Mark as deleted
      setEditedColumns(
        editedColumns.map((c) =>
          c.id === id ? { ...c, isDeleted: true } : c
        )
      );
    }
  };

  const updateColumn = (id: string, field: keyof ColumnEdit, value: any) => {
    setEditedColumns(
      editedColumns.map((col) => {
        if (col.id !== id) return col;
        
        const updated = { ...col, [field]: value };
        
        // Track renames
        if (field === "name" && !col.isNew && col.name !== value) {
          updated.isRenamed = true;
          updated.oldName = col.name;
        }
        
        // Track type changes
        if (field === "type" && !col.isNew && col.type !== value) {
          updated.oldType = col.type;
        }
        
        return updated;
      })
    );
  };

  const buildChanges = (): SchemaChange[] => {
    const changes: SchemaChange[] = [];
    const queries: string[] = [];

    // Process column changes
    for (const col of editedColumns) {
      if (col.isDeleted && !col.isNew) {
        // Drop column
        const query = `ALTER TABLE "${schema}"."${table}" DROP COLUMN "${col.name}"`;
        queries.push(query);
        const changeId = schemaChangeStager.stageDropColumn(
          schema,
          table,
          col.name,
          [query]
        );
        changes.push(schemaChangeStager.getChanges().find((c) => c.id === changeId)!);
      } else if (col.isNew && !col.isDeleted) {
        // Add column
        let query = `ALTER TABLE "${schema}"."${table}" ADD COLUMN "${col.name}" ${col.type}`;
        if (!col.nullable) query += " NOT NULL";
        if (col.defaultValue) query += ` DEFAULT ${col.defaultValue}`;
        queries.push(query);
        const changeId = schemaChangeStager.stageAddColumn(
          schema,
          table,
          col.name,
          col.type,
          [query],
          { nullable: col.nullable, defaultValue: col.defaultValue }
        );
        changes.push(schemaChangeStager.getChanges().find((c) => c.id === changeId)!);
      } else if (col.isRenamed && col.oldName) {
        // Rename column
        const query = `ALTER TABLE "${schema}"."${table}" RENAME COLUMN "${col.oldName}" TO "${col.name}"`;
        queries.push(query);
        const changeId = schemaChangeStager.stageRenameColumn(
          schema,
          table,
          col.oldName,
          col.name,
          [query]
        );
        changes.push(schemaChangeStager.getChanges().find((c) => c.id === changeId)!);
      } else if (col.oldType && col.oldType !== col.type) {
        // Alter column type
        const query = `ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${col.name}" TYPE ${col.type}`;
        queries.push(query);
        const changeId = schemaChangeStager.stageAlterColumn(
          schema,
          table,
          col.name,
          col.oldType,
          col.type,
          [query]
        );
        changes.push(schemaChangeStager.getChanges().find((c) => c.id === changeId)!);
      }
    }

    return changes;
  };

  const handleStageChanges = () => {
    // Validate
    const activeColumns = editedColumns.filter((c) => !c.isDeleted);
    const invalidColumns = activeColumns.filter((c) => !c.name.trim());
    if (invalidColumns.length > 0) {
      toast.error("Validation error", {
        description: "All columns must have a name",
      });
      return;
    }

    // Check for duplicate names
    const names = activeColumns.map((c) => c.name.toLowerCase());
    const duplicates = names.filter((name, idx) => names.indexOf(name) !== idx);
    if (duplicates.length > 0) {
      toast.error("Validation error", {
        description: "Column names must be unique",
      });
      return;
    }

    const changes = buildChanges();
    if (changes.length === 0) {
      toast.info("No changes to stage");
      return;
    }

    setPendingChanges(changes);
    onChangesStaged?.(changes);
    toast.success("Changes staged", {
      description: `${changes.length} change${changes.length !== 1 ? "s" : ""} ready for review`,
    });
  };

  const activeColumns = editedColumns.filter((c) => !c.isDeleted);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Table: {schema}.{table}</DialogTitle>
          <DialogDescription>
            Modify table structure. Changes will be staged for review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Columns</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addColumn}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Column
              </Button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {activeColumns.map((column, index) => (
                <div
                  key={column.id}
                  className={cn(
                    "p-4 border rounded-lg space-y-3",
                    column.isNew && "border-green-500/50 bg-green-500/5",
                    column.isDeleted && "opacity-50",
                    column.isRenamed && "border-blue-500/50 bg-blue-500/5",
                    column.oldType && "border-yellow-500/50 bg-yellow-500/5"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {column.isNew ? (
                        <span className="text-green-600 dark:text-green-400">New Column {index + 1}</span>
                      ) : column.isRenamed ? (
                        <span className="text-blue-600 dark:text-blue-400">
                          {column.oldName} → {column.name}
                        </span>
                      ) : (
                        `Column ${index + 1}`
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeColumn(column.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor={`col-name-${column.id}`}>Name</Label>
                      <Input
                        id={`col-name-${column.id}`}
                        value={column.name}
                        onChange={(e) =>
                          updateColumn(column.id, "name", e.target.value)
                        }
                        placeholder="column_name"
                        disabled={column.isDeleted}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor={`col-type-${column.id}`}>Type</Label>
                      <Select
                        value={column.type}
                        onValueChange={(value) =>
                          updateColumn(column.id, "type", value)
                        }
                        disabled={column.isDeleted}
                      >
                        <SelectTrigger id={`col-type-${column.id}`}>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {COLUMN_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`col-nullable-${column.id}`}
                        checked={column.nullable}
                        onChange={(e) =>
                          updateColumn(column.id, "nullable", e.target.checked)
                        }
                        className="rounded border-border"
                        disabled={column.isDeleted}
                      />
                      <Label htmlFor={`col-nullable-${column.id}`}>Nullable</Label>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor={`col-default-${column.id}`}>Default</Label>
                      <Input
                        id={`col-default-${column.id}`}
                        value={column.defaultValue}
                        onChange={(e) =>
                          updateColumn(column.id, "defaultValue", e.target.value)
                        }
                        placeholder="optional"
                        className="text-xs"
                        disabled={column.isDeleted}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleStageChanges}>
            <Edit2 className="h-4 w-4 mr-2" />
            Stage Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
