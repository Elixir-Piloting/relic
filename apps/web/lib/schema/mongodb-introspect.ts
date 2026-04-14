/**
 * MongoDB-specific schema introspection
 */

import { getPool, getCurrentConfig } from "@/lib/db/connection";
import { DatabaseProvider } from "@/lib/db/providers";
import type { TableInfo } from "@/lib/db/types";

/**
 * MongoDB doesn't have schemas - return a single "default" schema
 */
export async function getMongoDBSchemas(): Promise<string[]> {
  return ["default"]; // MongoDB uses databases, not schemas
}

/**
 * Get all collections (equivalent to tables) in MongoDB
 */
export async function getMongoDBCollections(schema: string = "default"): Promise<TableInfo[]> {
  const config = getCurrentConfig();
  if (!config || config.provider !== DatabaseProvider.MONGODB) {
    throw new Error("MongoDB adapter not available");
  }

  const adapter = getPool();
  if (!adapter) {
    throw new Error("Database adapter not available");
  }

  // Access the MongoDB database directly
  const mongoAdapter = adapter as any;
  if (!mongoAdapter.db) {
    throw new Error("MongoDB database not available");
  }

  try {
    // List all collections
    const collections = await mongoAdapter.db.listCollections().toArray();
    
    return collections.map((col: any) => ({
      schema: "default",
      name: col.name,
    }));
  } catch (error) {
    console.error("[MongoDB Introspect] Failed to list collections:", error);
    throw error;
  }
}

/**
 * Get document count for a collection
 */
export async function getMongoDBCollectionCount(collection: string): Promise<number> {
  const config = getCurrentConfig();
  if (!config || config.provider !== DatabaseProvider.MONGODB) {
    throw new Error("MongoDB adapter not available");
  }

  const adapter = getPool();
  if (!adapter) {
    throw new Error("Database adapter not available");
  }

  const mongoAdapter = adapter as any;
  if (!mongoAdapter.db) {
    throw new Error("MongoDB database not available");
  }

  try {
    return await mongoAdapter.db.collection(collection).countDocuments();
  } catch (error) {
    console.error("[MongoDB Introspect] Failed to count documents:", error);
    return 0;
  }
}
