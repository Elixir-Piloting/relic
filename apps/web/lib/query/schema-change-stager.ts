/**
 * Schema change staging system for tracking pending table structure changes
 */

export type SchemaChangeType = "ALTER_TABLE" | "DROP_TABLE" | "RENAME_TABLE" | "RENAME_COLUMN" | "ADD_COLUMN" | "DROP_COLUMN" | "ALTER_COLUMN";

export interface SchemaChange {
  id: string;
  type: SchemaChangeType;
  schema: string;
  table: string;
  queries: string[]; // SQL queries to execute
  description: string; // Human-readable description
  details?: {
    // For column changes
    columnName?: string;
    oldColumnName?: string;
    newColumnName?: string;
    oldType?: string;
    newType?: string;
    // For table operations
    oldTableName?: string;
    newTableName?: string;
  };
}

export class SchemaChangeStager {
  private changes: Map<string, SchemaChange> = new Map();

  /**
   * Stage an ALTER TABLE change
   */
  stageAlterTable(
    schema: string,
    table: string,
    queries: string[],
    description: string,
    details?: SchemaChange["details"]
  ): string {
    const changeId = `alter-${schema}.${table}-${Date.now()}`;
    const change: SchemaChange = {
      id: changeId,
      type: "ALTER_TABLE",
      schema,
      table,
      queries,
      description,
      details,
    };
    this.changes.set(changeId, change);
    return changeId;
  }

  /**
   * Stage a DROP TABLE change
   */
  stageDropTable(
    schema: string,
    table: string,
    queries: string[]
  ): string {
    const changeId = `drop-${schema}.${table}-${Date.now()}`;
    const change: SchemaChange = {
      id: changeId,
      type: "DROP_TABLE",
      schema,
      table,
      queries,
      description: `Drop table ${schema}.${table}`,
    };
    this.changes.set(changeId, change);
    return changeId;
  }

  /**
   * Stage a RENAME TABLE change
   */
  stageRenameTable(
    schema: string,
    oldTableName: string,
    newTableName: string,
    queries: string[]
  ): string {
    const changeId = `rename-table-${schema}.${oldTableName}-${Date.now()}`;
    const change: SchemaChange = {
      id: changeId,
      type: "RENAME_TABLE",
      schema,
      table: oldTableName,
      queries,
      description: `Rename table ${schema}.${oldTableName} to ${newTableName}`,
      details: {
        oldTableName,
        newTableName,
      },
    };
    this.changes.set(changeId, change);
    return changeId;
  }

  /**
   * Stage an ADD COLUMN change
   */
  stageAddColumn(
    schema: string,
    table: string,
    columnName: string,
    columnType: string,
    queries: string[],
    details?: { nullable?: boolean; defaultValue?: string }
  ): string {
    const changeId = `add-col-${schema}.${table}.${columnName}-${Date.now()}`;
    const change: SchemaChange = {
      id: changeId,
      type: "ADD_COLUMN",
      schema,
      table,
      queries,
      description: `Add column ${columnName} (${columnType}) to ${schema}.${table}`,
      details: {
        columnName,
        newType: columnType,
        ...details,
      },
    };
    this.changes.set(changeId, change);
    return changeId;
  }

  /**
   * Stage a DROP COLUMN change
   */
  stageDropColumn(
    schema: string,
    table: string,
    columnName: string,
    queries: string[]
  ): string {
    const changeId = `drop-col-${schema}.${table}.${columnName}-${Date.now()}`;
    const change: SchemaChange = {
      id: changeId,
      type: "DROP_COLUMN",
      schema,
      table,
      queries,
      description: `Drop column ${columnName} from ${schema}.${table}`,
      details: {
        columnName,
      },
    };
    this.changes.set(changeId, change);
    return changeId;
  }

  /**
   * Stage a RENAME COLUMN change
   */
  stageRenameColumn(
    schema: string,
    table: string,
    oldColumnName: string,
    newColumnName: string,
    queries: string[]
  ): string {
    const changeId = `rename-col-${schema}.${table}.${oldColumnName}-${Date.now()}`;
    const change: SchemaChange = {
      id: changeId,
      type: "RENAME_COLUMN",
      schema,
      table,
      queries,
      description: `Rename column ${oldColumnName} to ${newColumnName} in ${schema}.${table}`,
      details: {
        oldColumnName,
        newColumnName,
      },
    };
    this.changes.set(changeId, change);
    return changeId;
  }

  /**
   * Stage an ALTER COLUMN change (type change)
   */
  stageAlterColumn(
    schema: string,
    table: string,
    columnName: string,
    oldType: string,
    newType: string,
    queries: string[]
  ): string {
    const changeId = `alter-col-${schema}.${table}.${columnName}-${Date.now()}`;
    const change: SchemaChange = {
      id: changeId,
      type: "ALTER_COLUMN",
      schema,
      table,
      queries,
      description: `Alter column ${columnName} type from ${oldType} to ${newType} in ${schema}.${table}`,
      details: {
        columnName,
        oldType,
        newType,
      },
    };
    this.changes.set(changeId, change);
    return changeId;
  }

  /**
   * Get all pending changes
   */
  getChanges(): SchemaChange[] {
    return Array.from(this.changes.values());
  }

  /**
   * Get changes for a specific table
   */
  getChangesForTable(schema: string, table: string): SchemaChange[] {
    return Array.from(this.changes.values()).filter(
      (c) => c.schema === schema && c.table === table
    );
  }

  /**
   * Remove a change
   */
  removeChange(changeId: string): void {
    this.changes.delete(changeId);
  }

  /**
   * Clear all changes
   */
  clearChanges(): void {
    this.changes.clear();
  }

  /**
   * Clear changes for a specific table
   */
  clearChangesForTable(schema: string, table: string): void {
    const toRemove = Array.from(this.changes.entries()).filter(
      ([_, change]) => change.schema === schema && change.table === table
    );
    toRemove.forEach(([id]) => this.changes.delete(id));
  }

  /**
   * Get change count
   */
  getChangeCount(): number {
    return this.changes.size;
  }
}

// Global instance
export const schemaChangeStager = new SchemaChangeStager();
