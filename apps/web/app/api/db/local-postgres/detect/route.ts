import { NextResponse } from "next/server";
import { Client } from "pg";

interface LocalPostgresServer {
  host: string;
  port: number;
  version?: string;
  accessible: boolean;
}

function dedupeServers(servers: LocalPostgresServer[]): LocalPostgresServer[] {
  const seen = new Map<number, LocalPostgresServer>();
  
  for (const server of servers) {
    const key = server.port;
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, server);
    } else {
      if (server.host === "localhost" && existing.host !== "localhost") {
        seen.set(key, server);
      } else if (!existing.version && server.version) {
        seen.set(key, server);
      } else if (existing.accessible !== server.accessible) {
        if (existing.accessible) {
          seen.set(key, existing);
        } else {
          seen.set(key, server);
        }
      }
    }
  }
  
  return Array.from(seen.values()).sort((a, b) => a.port - b.port);
}

/**
 * GET /api/db/local-postgres/detect - Detect local PostgreSQL servers
 */
export async function GET() {
  const servers: LocalPostgresServer[] = [];
  const commonPorts = [5432, 5433, 5434, 5435];
  const hosts = ["localhost", "127.0.0.1"];

  const detectionPromises: Promise<LocalPostgresServer | null>[] = [];
  
  for (const host of hosts) {
    for (const port of commonPorts) {
      detectionPromises.push(
        (async (): Promise<LocalPostgresServer | null> => {
          let client = null;
          try {
            client = new Client({
              host,
              port,
              database: "postgres",
              user: process.env.USER || process.env.USERNAME || "postgres",
              password: "",
              connectionTimeoutMillis: 1000,
            });

            await client.connect();
            
            const versionResult = await client.query("SELECT version()");
            const version = versionResult.rows[0]?.version || "Unknown";
            
            await client.end();
            client = null;

            return {
              host,
              port,
              version,
              accessible: true,
            };
          } catch (error: any) {
            // Always try to close the client
            if (client) {
              try { await client.end(); } catch {}
              client = null;
            }
            
            // ECONNREFUSED means no server, any other error means server IS running
            if (error.code === "ECONNREFUSED") {
              return null;
            }
            // Server exists but needs auth or has connection limits
            return {
              host,
              port,
              accessible: false,
            };
          }
        })()
      );
    }
  }

  const results = await Promise.allSettled(detectionPromises);
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      servers.push(result.value);
    }
  }

  const dedupedServers = dedupeServers(servers);

  return NextResponse.json({ servers: dedupedServers });
}
