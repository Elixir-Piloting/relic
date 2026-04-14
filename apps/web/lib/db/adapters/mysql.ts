/**
 * MySQL adapter using mysql2 client
 */

import mysql from "mysql2/promise";
import type { ConnectionConfig } from "../types";
import { parseConnectionURL } from "../../connections/url-parser";
import type { DatabaseAdapter, QueryResult } from "./base";

export class MySQLAdapter implements DatabaseAdapter {
  private connection: mysql.Connection | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    let connectionParams: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl: boolean;
    };

    if (this.config.connectionString) {
      console.log("[MySQL] Parsing connection string...");
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
        port: this.config.port || 3306,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password || "",
        ssl: false,
      };
    }

    console.log("[MySQL] Creating connection...");
    const connectionOptions: any = {
      host: connectionParams.host,
      port: connectionParams.port,
      database: connectionParams.database,
      user: connectionParams.user,
      password: connectionParams.password,
    };
    
    if (connectionParams.ssl) {
      connectionOptions.ssl = { rejectUnauthorized: false };
    }
    
    this.connection = await mysql.createConnection(connectionOptions);

    console.log("[MySQL] Connected successfully");
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  async executeQuery<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.connection) {
      throw new Error("Not connected to database");
    }

    const [rows, fields] = await this.connection.execute(query, params || []);
    
    return {
      rows: rows as T[],
      rowCount: Array.isArray(rows) ? rows.length : 0,
      fields: fields ? fields.map((f: any) => ({
        name: f.name,
        dataTypeID: f.type,
        dataType: f.type,
      })) : [],
    };
  }

  isConnected(): boolean {
    return this.connection !== null;
  }
}
