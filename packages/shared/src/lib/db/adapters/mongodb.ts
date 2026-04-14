/**
 * MongoDB adapter using mongodb client
 */

import { MongoClient, Db, Collection } from "mongodb";
import type { ConnectionConfig } from "../types";
import { parseConnectionURL } from "../../connections/url-parser";
import type { DatabaseAdapter, QueryResult } from "./base";

export class MongoDBAdapter implements DatabaseAdapter {
  private client: MongoClient | null = null;
  public db: Db | null = null; // Make db public for introspection
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    let connectionString: string;
    let databaseName: string;

    if (this.config.connectionString) {
      console.log("[MongoDB] Using connection string directly...");
      
      // For MongoDB SRV URLs, use the connection string as-is
      // MongoDB client handles SRV DNS resolution automatically
      if (this.config.connectionString.startsWith("mongodb+srv://")) {
        connectionString = this.config.connectionString;
        // Extract database name from URL
        const parsed = parseConnectionURL(this.config.connectionString);
        databaseName = parsed.database || "";
      } else {
        // Regular MongoDB URL - use as-is (it may already be properly formatted)
        connectionString = this.config.connectionString;
        const parsed = parseConnectionURL(this.config.connectionString);
        databaseName = parsed.database || "";
      }
    } else {
      if (!this.config.host || !this.config.user) {
        throw new Error("Missing required connection parameters (host, user)");
      }
      const user = encodeURIComponent(this.config.user);
      const password = encodeURIComponent(this.config.password || "");
      const host = this.config.host;
      const port = this.config.port && this.config.port !== 27017 ? `:${this.config.port}` : "";
      connectionString = `mongodb://${user}:${password}@${host}${port}`;
      databaseName = this.config.database || "";
    }

    console.log("[MongoDB] Connecting to:", connectionString.replace(/:[^:@]+@/, ":***@"));
    this.client = new MongoClient(connectionString);

    await this.client.connect();
    console.log("[MongoDB] Connected successfully");

    if (databaseName) {
      this.db = this.client.db(databaseName);
      console.log("[MongoDB] Using database:", databaseName);
    } else {
      // Use default database
      this.db = this.client.db();
      console.log("[MongoDB] Using default database");
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  async executeQuery<T = any>(query: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.client || !this.db) {
      throw new Error("Not connected to database");
    }

    // MongoDB doesn't use SQL - we'll need to parse the query differently
    // For now, we'll support basic find operations
    // Format: db.collection.find({...})
    // Or: db.collection.aggregate([...])
    
    try {
      // Try to parse as MongoDB query
      // Support formats:
      // - db.collection.find({}).limit(n).skip(n)
      // - db.collection.find({})
      // - db.collection.count({})
      // - db.collection.aggregate([...])
      
      // More robust regex that handles empty objects and optional parts
      // Pattern: db.collection.find({...}).limit(n).skip(n)
      // Collection names can contain letters, numbers, hyphens, underscores
      const findPattern = /^db\.([\w-]+)\.find\((\{[^}]*\})?\)(\.limit\((\d+)\))?(\.skip\((\d+)\))?$/;
      const findMatch = query.match(findPattern);
      
      // Pattern: db.collection.count({...})
      const countPattern = /^db\.([\w-]+)\.count\((\{[^}]*\})?\)$/;
      const countMatch = query.match(countPattern);
      
      // Pattern: db.collection.aggregate([...])
      const aggregatePattern = /^db\.([\w-]+)\.aggregate\((\[.*\])\)$/;
      const aggregateMatch = query.match(aggregatePattern);
      
      // Pattern: db.collection.updateOne({filter}, {$set: {update}})
      // More flexible pattern that handles nested objects
      const updateOnePattern = /^db\.([\w-]+)\.updateOne\((.+),\s*(.+)\)$/;
      const updateOneMatch = query.match(updateOnePattern);
      
      // Pattern: db.collection.deleteOne({filter})
      // More flexible pattern that handles nested objects
      const deleteOnePattern = /^db\.([\w-]+)\.deleteOne\((.+)\)$/;
      const deleteOneMatch = query.match(deleteOnePattern);
      
      if (findMatch) {
        const [, collectionName, filterStr, , limitStr, , skipStr] = findMatch;
        const collection = this.db.collection(collectionName);
        
        // Parse filter - handle empty object {} or actual filter
        let filter = {};
        if (filterStr && filterStr.trim() && filterStr.trim() !== "{}") {
          try {
            filter = JSON.parse(filterStr);
          } catch {
            // If parsing fails, use empty filter
            filter = {};
          }
        }
        
        let cursor = collection.find(filter);
        
        if (limitStr) {
          cursor = cursor.limit(parseInt(limitStr, 10));
        }
        if (skipStr) {
          cursor = cursor.skip(parseInt(skipStr, 10));
        }
        
        const rows = await cursor.toArray();
        
        // Extract fields from first document if available
        const fields = rows.length > 0 
          ? Object.keys(rows[0]).map((key) => ({
              name: key,
              dataType: typeof rows[0][key],
            }))
          : [];
        
        return {
          rows: rows as T[],
          rowCount: rows.length,
          fields,
        };
      } else if (countMatch) {
        const [, collectionName, filterStr] = countMatch;
        const collection = this.db.collection(collectionName);
        
        let filter = {};
        if (filterStr && filterStr.trim() && filterStr.trim() !== "{}") {
          try {
            filter = JSON.parse(filterStr);
          } catch {
            filter = {};
          }
        }
        
        const rowCount = await collection.countDocuments(filter);
        
        return {
          rows: [{ count: rowCount }] as T[],
          rowCount: 1,
          fields: [{ name: "count", dataType: "number" }],
        };
      } else if (aggregateMatch) {
        const [, collectionName, pipelineStr] = aggregateMatch;
        const collection = this.db.collection(collectionName);
        const pipeline = JSON.parse(pipelineStr);
        const rows = await collection.aggregate(pipeline).toArray();
        
        const fields = rows.length > 0 
          ? Object.keys(rows[0]).map((key) => ({
              name: key,
              dataType: typeof rows[0][key],
            }))
          : [];
        
        return {
          rows: rows as T[],
          rowCount: rows.length,
          fields,
        };
      } else if (updateOneMatch) {
        const [, collectionName, filterStr, updateStr] = updateOneMatch;
        const collection = this.db.collection(collectionName);
        
        let filter = {};
        let update = {};
        try {
          filter = JSON.parse(filterStr);
          update = JSON.parse(updateStr);
        } catch (error) {
          throw new Error(`Failed to parse updateOne query: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
        
        const result = await collection.updateOne(filter, update);
        
        return {
          rows: [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }] as T[],
          rowCount: 1,
          fields: [{ name: "matchedCount", dataType: "number" }, { name: "modifiedCount", dataType: "number" }],
        };
      } else if (deleteOneMatch) {
        const [, collectionName, filterStr] = deleteOneMatch;
        const collection = this.db.collection(collectionName);
        
        let filter = {};
        try {
          filter = JSON.parse(filterStr);
        } catch (error) {
          throw new Error(`Failed to parse deleteOne query: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
        
        const result = await collection.deleteOne(filter);
        
        return {
          rows: [{ deletedCount: result.deletedCount }] as T[],
          rowCount: 1,
          fields: [{ name: "deletedCount", dataType: "number" }],
        };
      } else {
        // Log the actual query for debugging
        console.error("[MongoDB] Failed to parse query:", query);
        throw new Error(`MongoDB queries must be in format: db.collection.find({}).limit(n).skip(n), db.collection.updateOne({filter}, {update}), or db.collection.deleteOne({filter}). Got: ${query}`);
      }
    } catch (error) {
      throw new Error(`MongoDB query error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.db !== null;
  }
}
