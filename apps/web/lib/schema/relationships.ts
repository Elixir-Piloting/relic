import { executeQuery, getCurrentConfig } from "@/lib/db/connection";
import { DatabaseProvider } from "@/lib/db/providers";

export interface ForeignKeyRelationship {
  constraintName: string;
  fromSchema: string;
  fromTable: string;
  fromColumn: string;
  toSchema: string;
  toTable: string;
  toColumn: string;
}

export interface TableRelationship {
  table: string;
  schema: string;
  relationships: ForeignKeyRelationship[];
}

/**
 * Get all foreign key relationships for a table
 */
export async function getTableRelationships(
  schema: string,
  table: string
): Promise<ForeignKeyRelationship[]> {
  const config = getCurrentConfig();
  
  // SQLite uses PRAGMA
  if (config?.provider === DatabaseProvider.SQLITE) {
    const result = await executeQuery<{
      id: number;
      seq: number;
      table: string;
      from: string;
      to: string;
    }>(`PRAGMA foreign_key_list("${table}")`);
    
    return result.rows.map((r) => ({
      constraintName: `fk_${r.table}_${r.from}`,
      fromSchema: "main",
      fromTable: table,
      fromColumn: r.from,
      toSchema: "main",
      toTable: r.table,
      toColumn: r.to,
    }));
  }
  
  const query = `
    SELECT
      tc.constraint_name,
      kcu_from.table_schema AS from_schema,
      kcu_from.table_name AS from_table,
      kcu_from.column_name AS from_column,
      kcu_to.table_schema AS to_schema,
      kcu_to.table_name AS to_table,
      kcu_to.column_name AS to_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu_from
      ON tc.constraint_name = kcu_from.constraint_name
      AND tc.table_schema = kcu_from.table_schema
    JOIN information_schema.constraint_column_usage kcu_to
      ON tc.constraint_name = kcu_to.constraint_name
      AND tc.table_schema = kcu_to.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu_from.table_schema = $1
      AND kcu_from.table_name = $2
    ORDER BY tc.constraint_name, kcu_from.ordinal_position
  `;

  const result = await executeQuery<{
    constraint_name: string;
    from_schema: string;
    from_table: string;
    from_column: string;
    to_schema: string;
    to_table: string;
    to_column: string;
  }>(query, [schema, table]);

  return result.rows.map((r) => ({
    constraintName: r.constraint_name,
    fromSchema: r.from_schema,
    fromTable: r.from_table,
    fromColumn: r.from_column,
    toSchema: r.to_schema,
    toTable: r.to_table,
    toColumn: r.to_column,
  }));
}

/**
 * Get all foreign keys that reference a table
 */
export async function getReferencingTables(
  schema: string,
  table: string
): Promise<ForeignKeyRelationship[]> {
  const config = getCurrentConfig();
  
  // SQLite - find all tables that reference this table
  if (config?.provider === DatabaseProvider.SQLITE) {
    // Get all tables and their foreign keys
    const tables = await executeQuery<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    );
    
    const relationships: ForeignKeyRelationship[] = [];
    
    for (const t of tables.rows) {
      const fks = await executeQuery<{
        id: number;
        seq: number;
        table: string;
        from: string;
        to: string;
      }>(`PRAGMA foreign_key_list("${t.name}")`);
      
      for (const fk of fks.rows) {
        if (fk.table === table) {
          relationships.push({
            constraintName: `fk_${t.name}_${fk.from}`,
            fromSchema: "main",
            fromTable: t.name,
            fromColumn: fk.from,
            toSchema: "main",
            toTable: table,
            toColumn: fk.to,
          });
        }
      }
    }
    
    return relationships;
  }
  
  const query = `
    SELECT
      tc.constraint_name,
      kcu_from.table_schema AS from_schema,
      kcu_from.table_name AS from_table,
      kcu_from.column_name AS from_column,
      kcu_to.table_schema AS to_schema,
      kcu_to.table_name AS to_table,
      kcu_to.column_name AS to_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu_from
      ON tc.constraint_name = kcu_from.constraint_name
      AND tc.table_schema = kcu_from.table_schema
    JOIN information_schema.constraint_column_usage kcu_to
      ON tc.constraint_name = kcu_to.constraint_name
      AND tc.table_schema = kcu_to.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu_to.table_schema = $1
      AND kcu_to.table_name = $2
    ORDER BY tc.constraint_name, kcu_from.ordinal_position
  `;

  const result = await executeQuery<{
    constraint_name: string;
    from_schema: string;
    from_table: string;
    from_column: string;
    to_schema: string;
    to_table: string;
    to_column: string;
  }>(query, [schema, table]);

  return result.rows.map((r) => ({
    constraintName: r.constraint_name,
    fromSchema: r.from_schema,
    fromTable: r.from_table,
    fromColumn: r.from_column,
    toSchema: r.to_schema,
    toTable: r.to_table,
    toColumn: r.to_column,
  }));
}
