import type { ConnectionConfig } from "./types";
import { DatabaseProvider, getProviderMetadata } from "./providers";
import { PostgreSQLAdapter } from "./adapters/postgresql";
import { MongoDBAdapter } from "./adapters/mongodb";
import { MySQLAdapter } from "./adapters/mysql";
import { SQLiteAdapter } from "./adapters/sqlite";
import type { DatabaseAdapter, QueryResult } from "./adapters/base";

// Use global to persist across module reloads in Next.js dev mode
declare global {
  var __relic_connectionAdapter: DatabaseAdapter | null | undefined;
  var __relic_currentConfig: ConnectionConfig | null | undefined;
}

const getConnectionAdapter = (): DatabaseAdapter | null => {
  if (typeof globalThis !== "undefined") {
    return globalThis.__relic_connectionAdapter ?? null;
  }
  return null;
};

const setConnectionAdapter = (adapter: DatabaseAdapter | null): void => {
  if (typeof globalThis !== "undefined") {
    globalThis.__relic_connectionAdapter = adapter;
  }
};

const getCurrentConfigGlobal = (): ConnectionConfig | null => {
  if (typeof globalThis !== "undefined") {
    return globalThis.__relic_currentConfig ?? null;
  }
  return null;
};

const setCurrentConfigGlobal = (config: ConnectionConfig | null): void => {
  if (typeof globalThis !== "undefined") {
    globalThis.__relic_currentConfig = config;
  }
};

let connectionAdapter: DatabaseAdapter | null = null;
let currentConfig: ConnectionConfig | null = null;

/**
 * Creates a new database connection
 * Only one active connection at a time (single-user assumption)
 */
export async function connect(config: ConnectionConfig): Promise<void> {
  console.log("[Connection] Starting connection process for provider:", config.provider);
  
  // Get existing adapter from global or local
  const existingAdapter = getConnectionAdapter() || connectionAdapter;
  if (existingAdapter) {
    console.log("[Connection] Closing existing connection...");
    try {
      await existingAdapter.disconnect();
      console.log("[Connection] Existing connection closed");
    } catch (error) {
      console.log("[Connection] Error closing existing connection (may already be closed):", error);
    }
    // Clear references regardless
    connectionAdapter = null;
    setConnectionAdapter(null);
  }

  currentConfig = config;
  setCurrentConfigGlobal(config);
  
  // Create provider-specific adapter
  let adapter: DatabaseAdapter;
  
  switch (config.provider) {
    case DatabaseProvider.POSTGRESQL:
    case DatabaseProvider.SUPABASE:
      console.log("[Connection] Creating PostgreSQL adapter...");
      adapter = new PostgreSQLAdapter(config);
      break;
      
    case DatabaseProvider.MONGODB:
      console.log("[Connection] Creating MongoDB adapter...");
      adapter = new MongoDBAdapter(config);
      break;
      
    case DatabaseProvider.MYSQL:
    case DatabaseProvider.PLANETSCALE:
      console.log("[Connection] Creating MySQL adapter...");
      adapter = new MySQLAdapter(config);
      break;
      
case DatabaseProvider.SQLITE:
      console.log("[Connection] Creating SQLite adapter...");
      adapter = new SQLiteAdapter(config);
      break;
      
    case DatabaseProvider.MARIADB:
    case DatabaseProvider.SQLSERVER:
    case DatabaseProvider.CLICKHOUSE:
    case DatabaseProvider.REDIS:
    case DatabaseProvider.LIBSQL:
    case DatabaseProvider.VALTOWN:
    case DatabaseProvider.CLOUDFLARED1:
    case DatabaseProvider.NEON:
      throw new Error(`${getProviderMetadata(config.provider).name} is not yet supported. Use PostgreSQL, MySQL, MongoDB, or SQLite for now.`);
       
    default:
      throw new Error(`Unsupported database provider: ${config.provider}`);
  }

  // Connect
  try {
    await adapter.connect();
    connectionAdapter = adapter;
    setConnectionAdapter(adapter);
    console.log("[Connection] Connection successful");
  } catch (connectError) {
    console.error("[Connection] Connection failed:", connectError);
    // Clean up on failure
    connectionAdapter = null;
    setConnectionAdapter(null);
    currentConfig = null;
    setCurrentConfigGlobal(null);
    throw connectError;
  }
}

/**
 * Get the current connection adapter
 */
export function getPool(): DatabaseAdapter | null {
  // Check global first (persists across module reloads), then local
  const globalAdapter = getConnectionAdapter();
  if (globalAdapter) {
    return globalAdapter;
  }
  return connectionAdapter;
}

/**
 * Execute a query using the current connection
 */
export async function executeQuery<T = any>(
  query: string,
  params?: any[]
): Promise<QueryResult<T>> {
  console.log("[Connection] executeQuery called, query:", query.substring(0, 100), "...");
  
  // Get adapter from global or local
  let adapter = getPool();
  if (!adapter) {
    console.error("[Connection] No connection adapter available!");
    throw new Error("No database connection. Please connect first.");
  }

  // Check if adapter is still connected, try to reconnect if not
  if (!adapter.isConnected()) {
    console.log("[Connection] Adapter is not connected, attempting to reconnect...");
    const config = getCurrentConfig();
    if (config) {
      try {
        await connect(config);
        adapter = getPool();
        if (!adapter || !adapter.isConnected()) {
          throw new Error("Database connection was closed. Please reconnect.");
        }
        console.log("[Connection] Reconnection successful");
      } catch (reconnectError) {
        console.error("[Connection] Reconnection failed:", reconnectError);
        // Clear connection state
        connectionAdapter = null;
        currentConfig = null;
        setConnectionAdapter(null);
        setCurrentConfigGlobal(null);
        throw new Error("Database connection was closed. Please reconnect.");
      }
    } else {
      console.error("[Connection] No config available for reconnection");
      throw new Error("Database connection was closed. Please reconnect.");
    }
  }

  console.log("[Connection] Executing query...");
  try {
    const result = await adapter.executeQuery<T>(query, params);
    console.log("[Connection] Query executed successfully, rowCount:", result.rowCount);
    return result;
  } catch (queryError: any) {
    console.error("[Connection] Query execution failed:", queryError);
    
    // If adapter was closed, clear it
    if (queryError?.message?.includes("closed") || queryError?.message?.includes("not connected")) {
      console.log("[Connection] Adapter was closed, clearing connection state");
      connectionAdapter = null;
      currentConfig = null;
      setConnectionAdapter(null);
      setCurrentConfigGlobal(null);
    }
    
    throw queryError;
  }
}

/**
 * Get the adapter for transactions (returns the same adapter)
 */
export async function getClient(): Promise<DatabaseAdapter> {
  const adapter = getPool();
  if (!adapter) {
    throw new Error("No database connection. Please connect first.");
  }
  return adapter;
}

/**
 * Close the current connection
 */
export async function disconnect(): Promise<void> {
  const adapter = getConnectionAdapter() || connectionAdapter;
  if (adapter) {
    await adapter.disconnect();
    connectionAdapter = null;
    currentConfig = null;
    setConnectionAdapter(null);
    setCurrentConfigGlobal(null);
  }
}

/**
 * Get current connection config
 */
export function getCurrentConfig(): ConnectionConfig | null {
  // Check global first, then local
  const globalConfig = getCurrentConfigGlobal();
  if (globalConfig) {
    return globalConfig;
  }
  return currentConfig;
}
