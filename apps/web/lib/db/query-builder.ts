/**
 * Provider-aware query builder
 */

import { DatabaseProvider } from "./providers";

/**
 * Build a query to fetch table/collection data
 */
export function buildTableQuery(
  schema: string,
  table: string,
  limit: number,
  offset: number,
  provider?: DatabaseProvider
): { query: string; params?: any[] } {
  if (provider === DatabaseProvider.MONGODB) {
    // MongoDB: use find query format
    // Format: db.collection.find({}).limit(limit).skip(offset)
    return {
      query: `db.${table}.find({}).limit(${limit}).skip(${offset})`,
    };
  }
  
  // SQL databases
  return {
    query: `SELECT * FROM "${schema}"."${table}" LIMIT $1 OFFSET $2`,
    params: [limit, offset],
  };
}

/**
 * Build a query to count rows/documents
 */
export function buildCountQuery(
  schema: string, 
  table: string, 
  provider?: DatabaseProvider
): { query: string; params?: any[] } {
  if (provider === DatabaseProvider.MONGODB) {
    return {
      query: `db.${table}.count({})`,
    };
  }
  
  return {
    query: `SELECT COUNT(*) as count FROM "${schema}"."${table}"`,
  };
}
