import Dexie, { type Table } from "dexie";
import type { ConnectionConfig } from "@/lib/db/types";

export interface SavedConnection extends ConnectionConfig {
  createdAt?: number;
  updatedAt?: number;
}

export interface QueryTab {
  id: string;
  label: string;
  query: string;
}

export interface UiPreference {
  key: string;
  value: string;
}

class RelicDatabase extends Dexie {
  connections!: Table<SavedConnection, string>;
  queryTabs!: Table<QueryTab, string>;
  uiPreferences!: Table<UiPreference, string>;

  constructor() {
    super("RelicDB");
    
    this.version(1).stores({
      connections: "id, name, provider, createdAt",
      queryTabs: "id, label",
      uiPreferences: "key",
    });
  }
}

export const db = new RelicDatabase();

const connectionCache = new Map<string, SavedConnection>();

export async function saveConnection(connection: SavedConnection): Promise<void> {
  const now = Date.now();
  const existing = await db.connections.get(connection.id);
  
  await db.connections.put({
    ...connection,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  
  connectionCache.set(connection.id, connection);
}

export async function deleteConnection(id: string): Promise<void> {
  await db.connections.delete(id);
  connectionCache.delete(id);
}

export async function getConnection(id: string): Promise<SavedConnection | undefined> {
  const cached = connectionCache.get(id);
  if (cached) return cached;
  
  const conn = await db.connections.get(id);
  if (conn) {
    connectionCache.set(id, conn);
  }
  return conn;
}

export async function getAllConnections(): Promise<SavedConnection[]> {
  const connections = await db.connections.toArray();
  connections.forEach(conn => connectionCache.set(conn.id, conn));
  return connections;
}

export function preloadConnection(conn: SavedConnection): void {
  connectionCache.set(conn.id, conn);
}

export async function saveQueryTab(connectionId: string, tabs: QueryTab[]): Promise<void> {
  await db.queryTabs.where("id").startsWith(connectionId).delete();
  await db.queryTabs.bulkPut(tabs.map(tab => ({ ...tab, id: `${connectionId}_${tab.id}` })));
}

export async function getQueryTabs(connectionId: string): Promise<QueryTab[]> {
  return db.queryTabs.where("id").startsWith(connectionId).toArray();
}

export async function setUiPreference(key: string, value: string): Promise<void> {
  await db.uiPreferences.put({ key, value });
}

export async function getUiPreference(key: string): Promise<string | undefined> {
  const pref = await db.uiPreferences.get(key);
  return pref?.value;
}
