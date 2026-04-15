import { z } from "zod";
import { DatabaseProvider } from "./providers";

export const ConnectionConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  provider: z.nativeEnum(DatabaseProvider),
  // File path (for file-based providers like SQLite)
  filePath: z.string().optional(),
  // Connection string (for URL-based providers like LibSQL, Supabase, PlanetScale)
  connectionString: z.string().optional(),
  // Network connection fields
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  database: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().optional(),
  // SSH tunnel configuration
  ssh: z.boolean().optional(),
  sshHost: z.string().optional(),
  sshPort: z.number().int().min(1).max(65535).optional(),
  sshUser: z.string().optional(),
  sshKeyPath: z.string().optional(),
  sshPassword: z.string().optional(),
});

export function validateConnectionConfig(config: unknown) {
  const parsed = ConnectionConfigSchema.parse(config);
  const provider = parsed.provider;

  const errors: string[] = [];

  switch (provider) {
    case DatabaseProvider.SQLITE:
      if (!parsed.filePath) {
        errors.push("filePath is required for SQLite");
      }
      break;
    case DatabaseProvider.LIBSQL:
    case DatabaseProvider.SUPABASE:
    case DatabaseProvider.PLANETSCALE:
    case DatabaseProvider.NEON:
    case DatabaseProvider.VALTOWN:
    case DatabaseProvider.CLOUDFLARED1:
      if (!parsed.connectionString) {
        errors.push("connectionString is required for " + provider);
      }
      break;
    case DatabaseProvider.POSTGRESQL:
    case DatabaseProvider.MYSQL:
    case DatabaseProvider.MARIADB:
    case DatabaseProvider.MONGODB:
    case DatabaseProvider.SQLSERVER:
    case DatabaseProvider.CLICKHOUSE:
    case DatabaseProvider.REDIS:
      if (!parsed.host) errors.push("host is required for " + provider);
      if (!parsed.database) errors.push("database may be required for " + provider);
      if (!parsed.user && provider !== DatabaseProvider.REDIS) errors.push("user may be required for " + provider);
      break;
  }

  if (errors.length > 0) {
    throw new Error(errors.join(", "));
  }

  return parsed;
}

export type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: Array<{
    name: string;
    dataTypeID: number;
    dataTypeSize: number;
    format: string;
  }>;
}

export interface TableInfo {
  schema: string;
  name: string;
  rowCount?: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  characterMaximumLength: number | null;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

export interface ConstraintInfo {
  name: string;
  type: "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE" | "CHECK";
  columns: string[];
}
