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

const STORAGE_KEY = "relic_connections";
const TABS_KEY = "relic_query_tabs";
const UI_PREFS_KEY = "relic_ui_prefs";
const connectionCache = new Map<string, SavedConnection>();

export async function saveConnection(connection: SavedConnection): Promise<void> {
  const now = Date.now();
  const connections = await getAllConnections();
  
  const existingIndex = connections.findIndex(c => c.id === connection.id);
  let updated: SavedConnection[];
  
  if (existingIndex >= 0) {
    updated = [...connections];
    updated[existingIndex] = {
      ...connection,
      createdAt: connections[existingIndex].createdAt || now,
      updatedAt: now,
    };
  } else {
    updated = [...connections, {
      ...connection,
      createdAt: now,
      updatedAt: now,
    }];
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  connectionCache.set(connection.id, connection);
}

export async function deleteConnection(id: string): Promise<void> {
  const connections = await getAllConnections();
  const filtered = connections.filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  connectionCache.delete(id);
}

export async function getConnection(id: string): Promise<SavedConnection | undefined> {
  const cached = connectionCache.get(id);
  if (cached) return cached;
  
  const connections = await getAllConnections();
  const conn = connections.find(c => c.id === id);
  if (conn) {
    connectionCache.set(id, conn);
  }
  return conn;
}

export async function getAllConnections(): Promise<SavedConnection[]> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const connections: SavedConnection[] = stored ? JSON.parse(stored) : [];
    connections.forEach(conn => connectionCache.set(conn.id, conn));
    return connections;
  } catch (e) {
    console.error("Failed to load connections:", e);
    return [];
  }
}

export function preloadConnection(conn: SavedConnection): void {
  connectionCache.set(conn.id, conn);
}

export async function saveQueryTab(connectionId: string, tabs: QueryTab[]): Promise<void> {
  const key = `${TABS_KEY}_${connectionId}`;
  localStorage.setItem(key, JSON.stringify(tabs));
}

export async function getQueryTabs(connectionId: string): Promise<QueryTab[]> {
  const key = `${TABS_KEY}_${connectionId}`;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function setUiPreference(key: string, value: string): Promise<void> {
  try {
    const stored = localStorage.getItem(UI_PREFS_KEY);
    const prefs: Record<string, string> = stored ? JSON.parse(stored) : {};
    prefs[key] = value;
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error("Failed to set UI preference:", e);
  }
}

export async function getUiPreference(key: string): Promise<string | undefined> {
  try {
    const stored = localStorage.getItem(UI_PREFS_KEY);
    const prefs: Record<string, string> = stored ? JSON.parse(stored) : {};
    return prefs[key];
  } catch {
    return undefined;
  }
}
