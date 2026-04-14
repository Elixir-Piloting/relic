/**
 * PostgreSQL adapter using pg client
 */

import { Client, QueryResult as PGQueryResult } from "pg";
import type { ConnectionConfig } from "../types";
import { parseConnectionURL } from "../../connections/url-parser";
import type { DatabaseAdapter, QueryResult } from "./base";

export class PostgreSQLAdapter implements DatabaseAdapter {
  private client: Client | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // Parse connection string if provided
    let connectionParams: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl: boolean;
    };

    if (this.config.connectionString) {
      console.log("[PostgreSQL] Parsing connection string...");
      const parsed = parseConnectionURL(this.config.connectionString);
      connectionParams = {
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        user: parsed.user,
        password: parsed.password,
        ssl: parsed.ssl || false,
      };
    } else {
      if (!this.config.host || !this.config.database || !this.config.user) {
        throw new Error("Missing required connection parameters (host, database, user)");
      }
      connectionParams = {
        host: this.config.host,
        port: this.config.port || 5432,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password || "",
        ssl: false,
      };
    }

    console.log("[PostgreSQL] Creating connection client...");
    this.client = new Client({
      host: connectionParams.host,
      port: connectionParams.port,
      database: connectionParams.database,
      user: connectionParams.user,
      password: connectionParams.password,
      ssl: connectionParams.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    });

    await this.client.connect();
    console.log("[PostgreSQL] Connected successfully");
    
    // Test connection
    await this.client.query("SELECT 1");
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  async executeQuery<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.client) {
      throw new Error("Not connected to database");
    }

    const clientAny = this.client as any;
    if (clientAny._ending || clientAny._connectionError) {
      throw new Error("Database connection was closed. Please reconnect.");
    }

    const result: PGQueryResult<any> = await this.client.query(query, params);
    
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
      fields: result.fields.map((f) => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
        dataTypeSize: f.dataTypeSize,
        format: f.format,
      })),
    };
  }

  isConnected(): boolean {
    if (!this.client) return false;
    // Check if client is ending or has connection error
    const clientAny = this.client as any;
    if (clientAny._ending || clientAny._connectionError) return false;
    // Check if the connection stream is still writable (more reliable check)
    try {
      return this.client.connection?.stream?.writable !== false;
    } catch {
      // If we can't check, assume disconnected
      return false;
    }
  }
}
