import { z } from "zod";
import { DatabaseProvider } from "./providers";

export const ConnectionConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  provider: z.nativeEnum(DatabaseProvider),
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  database: z.string().min(1).optional(),
  user: z.string().min(1).optional(),
  password: z.string().optional(),
  // For file-based databases (SQLite)
  filePath: z.string().optional(),
  // For connection strings
  connectionString: z.string().optional(),
  // Connection options
  ssl: z.boolean().optional(),
  ssh: z.boolean().optional(),
  // SSH tunnel configuration (used when ssh is true)
  sshHost: z.string().optional(),
  sshPort: z.number().int().min(1).max(65535).optional(),
  sshUser: z.string().optional(),
  sshKeyPath: z.string().optional(),
  sshPassword: z.string().optional(),
});

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
