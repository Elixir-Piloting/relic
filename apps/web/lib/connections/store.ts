import { getConnection as dbGetConnection, preloadConnection, getAllConnections } from "@/lib/db/indexeddb";
import type { ConnectionConfig } from "@/lib/db/types";

export function getConnection(id: string): ConnectionConfig | null {
  if (typeof window === "undefined") return null;
  return dbGetConnection(id).then(conn => conn || null) as unknown as ConnectionConfig | null;
}

export async function getConnectionAsync(id: string): Promise<ConnectionConfig | null> {
  return dbGetConnection(id).then(conn => conn || null);
}

export async function loadConnections(): Promise<ConnectionConfig[]> {
  return getAllConnections();
}

export { preloadConnection };
