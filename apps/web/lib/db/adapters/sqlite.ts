/**
 * SQLite adapter using better-sqlite3
 */

import Database from "better-sqlite3";
import type { ConnectionConfig } from "../types";
import type { DatabaseAdapter, QueryResult } from "./base";

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config.filePath) {
      throw new Error("SQLite requires a file path");
    }

    console.log("[SQLite] Opening database:", this.config.filePath);
    this.db = new Database(this.config.filePath, { readonly: false });
    console.log("[SQLite] Connected successfully");
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async executeQuery<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.db) {
      throw new Error("Not connected to database");
    }

    // better-sqlite3 is synchronous, but we need to make it async-compatible
    try {
      const stmt = this.db.prepare(query);
      const result = params && params.length > 0 ? stmt.all(...params) : stmt.all();
      
      // Get column info from the statement
      const columns = stmt.columns();
      
      return {
        rows: result as T[],
        rowCount: Array.isArray(result) ? result.length : 0,
        fields: columns.map((col: any) => ({
          name: col.name,
          dataType: col.type,
        })),
      };
    } catch (error) {
      throw new Error(`SQLite query error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  isConnected(): boolean {
    return this.db !== null;
  }
}
