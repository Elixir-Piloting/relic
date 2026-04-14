"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, X } from "lucide-react";

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string;
  primaryKey: boolean;
}

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

interface CreateTableDialogProps {
  schema?: string;
  onTableCreated?: () => void;
}

export function CreateTableDialog({
  schema = "public",
  onTableCreated,
}: CreateTableDialogProps) {
  const [open, setOpen] = useState(false);
  const [tableName, setTableName] = useState("");
  const [columns, setColumns] = useState<Column[]>([
    {
      name: "id",
      type: "BIGINT",
      nullable: false,
      defaultValue: "",
      primaryKey: true,
    },
  ]);

  const addColumn = () => {
    setColumns([
      ...columns,
      {
        name: "",
        type: "VARCHAR",
        nullable: true,
        defaultValue: "",
        primaryKey: false,
      },
    ]);
  };

  const removeColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, field: keyof Column, value: any) => {
    const updated = [...columns];
    updated[index] = { ...updated[index], [field]: value };
    
    // Only one primary key allowed
    if (field === "primaryKey" && value) {
      updated.forEach((col, i) => {
        if (i !== index) col.primaryKey = false;
      });
    }
    
    setColumns(updated);
  };

  const handleCreate = async () => {
    if (!tableName.trim()) {
      toast.error("Validation error", {
        description: "Table name is required",
      });
      return;
    }

    if (columns.length === 0) {
      toast.error("Validation error", {
        description: "At least one column is required",
      });
      return;
    }

    const invalidColumns = columns.filter((c) => !c.name.trim());
    if (invalidColumns.length > 0) {
      toast.error("Validation error", {
        description: "All columns must have a name",
      });
      return;
    }

    try {
      // Build CREATE TABLE SQL
      const columnDefs = columns.map((col) => {
        let def = `"${col.name}" ${col.type}`;
        if (!col.nullable) def += " NOT NULL";
        if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
        return def;
      });

      const primaryKeys = columns
        .filter((col) => col.primaryKey)
        .map((col) => `"${col.name}"`);

      let sql = `CREATE TABLE "${schema}"."${tableName}" (\n`;
      sql += columnDefs.join(",\n");
      if (primaryKeys.length > 0) {
        sql += `,\n  PRIMARY KEY (${primaryKeys.join(", ")})`;
      }
      sql += "\n);";

      const response = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.error("Failed to create table", {
          description: data.error || "Unknown error",
        });
        return;
      }

      setOpen(false);
      setTableName("");
      setColumns([
        {
          name: "id",
          type: "BIGINT",
          nullable: false,
          defaultValue: "",
          primaryKey: true,
        },
      ]);
      toast.success("Table created", {
        description: `Table "${tableName}" created successfully`,
      });
      onTableCreated?.();
    } catch (error) {
      toast.error("Failed to create table", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Table</DialogTitle>
          <DialogDescription>
            Define the table structure in schema: {schema}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="table-name">Table Name</Label>
            <Input
              id="table-name"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="users"
            />
          </div>

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
              {columns.map((column, index) => (
                <div
                  key={index}
                  className="p-4 border border-border rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Column {index + 1}</span>
                    {columns.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeColumn(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor={`col-name-${index}`}>Name</Label>
                      <Input
                        id={`col-name-${index}`}
                        value={column.name}
                        onChange={(e) =>
                          updateColumn(index, "name", e.target.value)
                        }
                        placeholder="column_name"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor={`col-type-${index}`}>Type</Label>
                      <Select
                        value={column.type}
                        onValueChange={(value) =>
                          updateColumn(index, "type", value)
                        }
                      >
                        <SelectTrigger id={`col-type-${index}`}>
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
                        id={`col-nullable-${index}`}
                        checked={column.nullable}
                        onChange={(e) =>
                          updateColumn(index, "nullable", e.target.checked)
                        }
                        className="rounded border-border"
                      />
                      <Label htmlFor={`col-nullable-${index}`}>Nullable</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`col-pk-${index}`}
                        checked={column.primaryKey}
                        onChange={(e) =>
                          updateColumn(index, "primaryKey", e.target.checked)
                        }
                        className="rounded border-border"
                      />
                      <Label htmlFor={`col-pk-${index}`}>Primary Key</Label>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor={`col-default-${index}`}>Default</Label>
                      <Input
                        id={`col-default-${index}`}
                        value={column.defaultValue}
                        onChange={(e) =>
                          updateColumn(index, "defaultValue", e.target.value)
                        }
                        placeholder="optional"
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create Table</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
