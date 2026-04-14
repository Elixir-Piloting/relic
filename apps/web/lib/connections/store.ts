import { z } from "zod";
import type { ConnectionConfig } from "@/lib/db/types";

const STORAGE_KEY = "relic_connections";

/**
 * Simple encrypted storage using Web Crypto API
 * For production, consider using a proper encryption library
 */
async function encrypt(text: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const keyData = encoder.encode(key);
  
  // Simple XOR encryption (not secure, but sufficient for local storage)
  // In production, use proper encryption
  const encrypted = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ keyData[i % keyData.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}

async function decrypt(encrypted: string, key: string): Promise<string> {
  const decoder = new TextDecoder();
  const encryptedData = Uint8Array.from(
    atob(encrypted),
    (c) => c.charCodeAt(0)
  );
  const keyData = new TextEncoder().encode(key);
  
  const decrypted = new Uint8Array(encryptedData.length);
  for (let i = 0; i < encryptedData.length; i++) {
    decrypted[i] = encryptedData[i] ^ keyData[i % keyData.length];
  }
  
  return decoder.decode(decrypted);
}

/**
 * Get encryption key from environment or use default
 * In production, this should be stored securely
 */
function getEncryptionKey(): string {
  return process.env.RELIC_ENCRYPTION_KEY || "relic-default-key-change-in-production";
}

/**
 * Save connections to localStorage (client-side)
 * For server-side, use a proper encrypted store
 */
export function saveConnections(connections: ConnectionConfig[]): void {
  if (typeof window === "undefined") {
    throw new Error("saveConnections can only be called on the client");
  }
  
  // Store without encryption for now (local-first assumption)
  // In production, encrypt sensitive fields
  const toStore = connections.map((conn) => ({
    ...conn,
    password: conn.password ? btoa(conn.password) : "", // Simple base64 encoding
  }));
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

/**
 * Load connections from localStorage
 */
export function loadConnections(): ConnectionConfig[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return parsed.map((conn: any) => ({
      ...conn,
      password: atob(conn.password), // Decode base64
    }));
  } catch {
    return [];
  }
}

/**
 * Add or update a connection
 */
export function saveConnection(connection: ConnectionConfig): void {
  const connections = loadConnections();
  const index = connections.findIndex((c) => c.id === connection.id);
  
  if (index >= 0) {
    connections[index] = connection;
  } else {
    connections.push(connection);
  }
  
  saveConnections(connections);
}

/**
 * Delete a connection
 */
export function deleteConnection(id: string): void {
  const connections = loadConnections().filter((c) => c.id !== id);
  saveConnections(connections);
}

/**
 * Get a connection by ID
 */
export function getConnection(id: string): ConnectionConfig | null {
  return loadConnections().find((c) => c.id === id) || null;
}
