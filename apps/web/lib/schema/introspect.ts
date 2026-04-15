import { executeQuery, getCurrentConfig } from "@/lib/db/connection";
import { DatabaseProvider } from "@/lib/db/providers";
import { getMongoDBSchemas, getMongoDBCollections, getMongoDBCollectionCount } from "./mongodb-introspect";
import type {
  TableInfo,
  ColumnInfo,
  IndexInfo,
  ConstraintInfo,
} from "@/lib/db/types";

/**
 * Get all schemas (provider-aware)
 */
export async function getSchemas(): Promise<string[]> {
  const config = getCurrentConfig();
  
  // MongoDB doesn't have schemas
  if (config?.provider === DatabaseProvider.MONGODB) {
    return getMongoDBSchemas();
  }
  
  // SQLite - there's only one "main" schema
  if (config?.provider === DatabaseProvider.SQLITE) {
    return ["main"];
  }
  
  const query = `SELECT schema_name 
     FROM information_schema.schemata 
     WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_toast_temp_1')
     ORDER BY CASE WHEN schema_name = 'public' THEN 0 ELSE 1 END, schema_name`;
  
  try {
    const result = await executeQuery<{ schema_name: string }>(query);
    return result.rows.map((r) => r.schema_name);
  } catch (error) {
    console.error("[Schema Introspect] Get schemas failed:", error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Get all tables/collections in a schema (provider-aware)
 */
export async function getTables(schema: string = "main"): Promise<TableInfo[]> {
  const config = getCurrentConfig();
  
  // MongoDB uses collections instead of tables
  if (config?.provider === DatabaseProvider.MONGODB) {
    return getMongoDBCollections(schema);
  }
  
  // SQLite uses a different query
  if (config?.provider === DatabaseProvider.SQLITE) {
    const result = await executeQuery<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    );
    return result.rows.map((r) => ({
      schema: "main",
      name: r.name,
    }));
  }
  
  const result = await executeQuery<{
    table_schema: string;
    table_name: string;
  }>(
    `SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schema]
  );
  
  return result.rows.map((r) => ({
    schema: r.table_schema,
    name: r.table_name,
  }));
}

/**
 * Get row/document count for a table/collection (lazy-loaded, provider-aware)
 */
export async function getTableRowCount(
  schema: string,
  table: string
): Promise<number> {
  const config = getCurrentConfig();
  
  // MongoDB uses collections
  if (config?.provider === DatabaseProvider.MONGODB) {
    return getMongoDBCollectionCount(table);
  }
  
  // SQLite uses different syntax (no schema prefix)
  if (config?.provider === DatabaseProvider.SQLITE) {
    const result = await executeQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM "${table}"`
    );
    return result.rows[0].count;
  }
  
  const result = await executeQuery<{ count: string }>(
    `SELECT COUNT(*) as count FROM "${schema}"."${table}"`
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get columns for a table
 */
export async function getColumns(
  schema: string,
  table: string
): Promise<ColumnInfo[]> {
  const config = getCurrentConfig();
  
  // SQLite uses PRAGMA to get column info
  if (config?.provider === DatabaseProvider.SQLITE) {
    const result = await executeQuery<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
    }>(`PRAGMA table_info("${table}")`);
    
    return result.rows.map((r) => ({
      name: r.name,
      dataType: r.type || "TEXT",
      isNullable: r.notnull === 0,
      defaultValue: r.dflt_value,
      characterMaximumLength: null,
    }));
  }
  
  const result = await executeQuery<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
    character_maximum_length: number | null;
  }>(
    `SELECT 
       column_name,
       data_type,
       is_nullable,
       column_default,
       character_maximum_length
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [schema, table]
  );
  
  return result.rows.map((r) => ({
    name: r.column_name,
    dataType: r.data_type,
    isNullable: r.is_nullable === "YES",
    defaultValue: r.column_default,
    characterMaximumLength: r.character_maximum_length,
  }));
}

/**
 * Get indexes for a table
 */
export async function getIndexes(
  schema: string,
  table: string
): Promise<IndexInfo[]> {
  const result = await executeQuery<{
    indexname: string;
    indexdef: string;
  }>(
    `SELECT 
       indexname,
       indexdef
     FROM pg_indexes
     WHERE schemaname = $1 AND tablename = $2
     ORDER BY indexname`,
    [schema, table]
  );
  
  return result.rows.map((r) => {
    const isUnique = r.indexdef.includes("UNIQUE");
    const isPrimary = r.indexname.includes("_pkey");
    
    // Extract column names from index definition
    const match = r.indexdef.match(/\(([^)]+)\)/);
    const columns = match
      ? match[1].split(",").map((c) => c.trim().replace(/"/g, ""))
      : [];
    
    return {
      name: r.indexname,
      columns,
      isUnique,
      isPrimary,
    };
  });
}

/**
 * Get constraints for a table
 */
export async function getConstraints(
  schema: string,
  table: string
): Promise<ConstraintInfo[]> {
  const result = await executeQuery<{
    constraint_name: string;
    constraint_type: string;
    column_name: string;
  }>(
    `SELECT 
       tc.constraint_name,
       tc.constraint_type,
       kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = $1 
       AND tc.table_name = $2
     ORDER BY tc.constraint_name, kcu.ordinal_position`,
    [schema, table]
  );
  
  const constraintsMap = new Map<string, ConstraintInfo>();
  
  for (const row of result.rows) {
    const existing = constraintsMap.get(row.constraint_name);
    if (existing) {
      existing.columns.push(row.column_name);
    } else {
      constraintsMap.set(row.constraint_name, {
        name: row.constraint_name,
        type: row.constraint_type as ConstraintInfo["type"],
        columns: [row.column_name],
      });
    }
  }
  
  return Array.from(constraintsMap.values());
}
