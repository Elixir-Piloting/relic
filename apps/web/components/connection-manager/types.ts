export interface ConnectionManagerProps {
  onConnectionSelect: (config: ConnectionConfig) => void;
  currentConnectionId?: string;
  defaultOpen?: boolean;
  onDialogChange?: (open: boolean) => void;
}

export interface ConnectionFormData {
  id?: string;
  name: string;
  provider: DatabaseProvider;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  connectionString?: string;
  filePath?: string;
}

export type ConnectionMode = "fields" | "url";
export type DialogStep = 1 | 2;

export const DEFAULT_FORM_DATA: ConnectionFormData = {
  name: "",
  provider: DatabaseProvider.POSTGRESQL,
  host: "localhost",
  port: 5432,
  database: "",
  user: "",
  password: "",
  connectionString: "",
};

import type { ConnectionConfig } from "@/lib/db/types";
import { DatabaseProvider } from "@/lib/db/providers";