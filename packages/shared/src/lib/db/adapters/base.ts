/**
 * Base interface for database adapters
 */

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  executeQuery<T = any>(query: string, params?: any[]): Promise<QueryResult<T>>;
  isConnected(): boolean;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  fields: Array<{
    name: string;
    dataTypeID?: number;
    dataTypeSize?: number;
    format?: string;
    dataType?: string;
  }>;
}

// Re-export for backward compatibility
export type { QueryResult as QueryResultType };
