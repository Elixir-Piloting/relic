/**
 * Change staging system for tracking pending edits
 */

export type ChangeType = "UPDATE" | "INSERT" | "DELETE";

export interface PendingChange {
  id: string;
  type: ChangeType;
  schema: string;
  table: string;
  originalRow?: Record<string, any>;
  newRow?: Record<string, any>;
  primaryKeys: string[];
  query: string;
  params: any[];
}

export class ChangeStager {
  private changes: Map<string, PendingChange> = new Map();

  /**
   * Stage an update change
   */
  stageUpdate(
    schema: string,
    table: string,
    originalRow: Record<string, any>,
    newRow: Record<string, any>,
    primaryKeys: string[],
    query: string,
    params: any[]
  ): string {
    const changeId = this.generateChangeId(schema, table, originalRow, primaryKeys);
    const change: PendingChange = {
      id: changeId,
      type: "UPDATE",
      schema,
      table,
      originalRow,
      newRow,
      primaryKeys,
      query,
      params,
    };
    this.changes.set(changeId, change);
    return changeId;
  }

  /**
   * Stage an insert change
   */
  stageInsert(
    schema: string,
    table: string,
    newRow: Record<string, any>,
    query: string,
    params: any[]
  ): string {
    const changeId = `insert-${Date.now()}-${Math.random()}`;
    const change: PendingChange = {
      id: changeId,
      type: "INSERT",
      schema,
      table,
      newRow,
      primaryKeys: [],
      query,
      params,
    };
    this.changes.set(changeId, change);
    return changeId;
  }

  /**
   * Stage a delete change
   */
  stageDelete(
    schema: string,
    table: string,
    row: Record<string, any>,
    primaryKeys: string[],
    query: string,
    params: any[]
  ): string {
    const changeId = this.generateChangeId(schema, table, row, primaryKeys);
    const change: PendingChange = {
      id: changeId,
      type: "DELETE",
      schema,
      table,
      originalRow: row,
      primaryKeys,
      query,
      params,
    };
    this.changes.set(changeId, change);
    return changeId;
  }

  /**
   * Get all pending changes
   */
  getChanges(): PendingChange[] {
    return Array.from(this.changes.values());
  }

  /**
   * Get changes for a specific table
   */
  getChangesForTable(schema: string, table: string): PendingChange[] {
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

  /**
   * Generate a unique change ID based on table and primary keys
   */
  private generateChangeId(
    schema: string,
    table: string,
    row: Record<string, any>,
    primaryKeys: string[]
  ): string {
    const keyParts = primaryKeys.map((pk) => `${pk}:${row[pk]}`).join("|");
    return `${schema}.${table}.${keyParts}`;
  }
}

// Global instance
export const changeStager = new ChangeStager();
