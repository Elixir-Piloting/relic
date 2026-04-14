import type { ConnectionConfig } from "@/lib/db/types";

export interface LocalPostgresServer {
  host: string;
  port: number;
  version?: string;
  accessible?: boolean;
  databases?: string[];
  expanded?: boolean;
  loadingDatabases?: boolean;
}

export interface LocalPostgresManagerProps {
  onServerSelect: (config: ConnectionConfig) => void;
  onCreateDatabase: (config: ConnectionConfig) => void;
}