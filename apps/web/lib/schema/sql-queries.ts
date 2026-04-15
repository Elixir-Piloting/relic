import { DatabaseProvider } from "@/lib/db/providers";

export interface SqlQueries {
  getSchemas: {
    sql: string;
    params?: any[];
  };
  getTables: {
    sql: string;
    params?: any[];
  };
  getColumns: {
    sql: string;
    params?: any[];
  };
  getIndexes: {
    sql: string;
    params?: any[];
  };
  getConstraints: {
    sql: string;
    params?: any[];
  };
}

export const sqlQueriesRegistry: Record<DatabaseProvider, SqlQueries> = {
  [DatabaseProvider.POSTGRESQL]: {
    getSchemas: {
      sql: `SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_toast_temp_1')
ORDER BY CASE WHEN schema_name = 'public' THEN 0 ELSE 1 END, schema_name`,
    },
    getTables: {
      sql: `SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = $1 AND table_type = 'BASE TABLE'
ORDER BY table_name`,
      params: ["schema"],
    },
    getColumns: {
      sql: `SELECT 
   column_name,
   data_type,
   is_nullable,
   column_default,
   character_maximum_length
FROM information_schema.columns
WHERE table_schema = $1 AND table_name = $2
ORDER BY ordinal_position`,
      params: ["schema", "table"],
    },
    getIndexes: {
      sql: `SELECT 
   indexname,
   indexdef
FROM pg_indexes
WHERE schemaname = $1 AND tablename = $2
ORDER BY indexname`,
      params: ["schema", "table"],
    },
    getConstraints: {
      sql: `SELECT 
   tc.constraint_name,
   tc.constraint_type,
   kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = $1 AND tc.table_name = $2
ORDER BY tc.constraint_name, kcu.ordinal_position`,
      params: ["schema", "table"],
    },
  },
  [DatabaseProvider.MYSQL]: {
    getSchemas: {
      sql: `SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
ORDER BY schema_name`,
    },
    getTables: {
      sql: `SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = ? AND table_type = 'BASE TABLE'
ORDER BY table_name`,
      params: ["schema"],
    },
    getColumns: {
      sql: `SELECT 
   column_name,
   data_type,
   is_nullable,
   column_default,
   character_maximum_length
FROM information_schema.columns
WHERE table_schema = ? AND table_name = ?
ORDER BY ordinal_position`,
      params: ["schema", "table"],
    },
    getIndexes: {
      sql: `SELECT 
   index_name,
   non_unique,
   column_name,
   seq_in_index
FROM information_schema.statistics
WHERE table_schema = ? AND table_name = ?
ORDER BY index_name, seq_in_index`,
      params: ["schema", "table"],
    },
    getConstraints: {
      sql: `SELECT 
   tc.constraint_name,
   tc.constraint_type,
   kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = ? AND tc.table_name = ?
ORDER BY tc.constraint_name, kcu.ordinal_position`,
      params: ["schema", "table"],
    },
  },
  [DatabaseProvider.MONGODB]: {
    getSchemas: {
      sql: "/* MongoDB - database is already set in connection */",
    },
    getTables: {
      sql: "/* MongoDB uses collections */",
    },
    getColumns: {
      sql: "/* MongoDB uses documents */",
    },
    getIndexes: {
      sql: "/* MongoDB uses indexes */",
    },
    getConstraints: {
      sql: "/* MongoDB uses validation rules */",
    },
  },
  [DatabaseProvider.SQLITE]: {
    getSchemas: {
      sql: "/* SQLite uses 'main' as the only schema - handled in introspect.ts */",
    },
    getTables: {
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    },
    getColumns: {
      sql: `PRAGMA table_info("[[TABLE_NAME]]")`,
      params: ["table"],
    },
    getIndexes: {
      sql: `PRAGMA index_list("[[TABLE_NAME]]")`,
      params: ["table"],
    },
    getConstraints: {
      sql: `PRAGMA foreign_key_list("[[TABLE_NAME]]")`,
      params: ["table"],
    },
  },
  [DatabaseProvider.LIBSQL]: {
    getSchemas: {
      sql: "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name",
    },
    getTables: {
      sql: `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name`,
      params: ["schema"],
    },
    getColumns: {
      sql: `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position`,
      params: ["schema", "table"],
    },
    getIndexes: {
      sql: `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = ? AND tablename = ? ORDER BY indexname`,
      params: ["schema", "table"],
    },
    getConstraints: {
      sql: `SELECT tc.constraint_name, tc.constraint_type, kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.table_schema = ? AND tc.table_name = ? ORDER BY tc.constraint_name, kcu.ordinal_position`,
      params: ["schema", "table"],
    },
  },
  [DatabaseProvider.SUPABASE]: {
    getSchemas: {
      sql: `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') ORDER BY CASE WHEN schema_name = 'public' THEN 0 ELSE 1 END, schema_name`,
    },
    getTables: {
      sql: `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name`,
      params: ["schema"],
    },
    getColumns: {
      sql: `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position`,
      params: ["schema", "table"],
    },
    getIndexes: {
      sql: `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = ? AND tablename = ? ORDER BY indexname`,
      params: ["schema", "table"],
    },
    getConstraints: {
      sql: `SELECT tc.constraint_name, tc.constraint_type, kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.table_schema = ? AND tc.table_name = ? ORDER BY tc.constraint_name, kcu.ordinal_position`,
      params: ["schema", "table"],
    },
  },
  [DatabaseProvider.PLANETSCALE]: {
    getSchemas: {
      sql: `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys') ORDER BY schema_name`,
    },
    getTables: {
      sql: `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name`,
      params: ["schema"],
    },
    getColumns: {
      sql: `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position`,
      params: ["schema", "table"],
    },
    getIndexes: {
      sql: `SELECT index_name, non_unique, column_name, seq_in_index FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? ORDER BY index_name, seq_in_index`,
      params: ["schema", "table"],
    },
    getConstraints: {
      sql: `SELECT tc.constraint_name, tc.constraint_type, kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.table_schema = ? AND tc.table_name = ? ORDER BY tc.constraint_name, kcu.ordinal_position`,
      params: ["schema", "table"],
    },
  },
};

export function getProviderSqlQueries(provider: DatabaseProvider): SqlQueries {
  return sqlQueriesRegistry[provider];
}