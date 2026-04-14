import { NextResponse } from "next/server";
import { Client } from "pg";

interface LocalPostgresServer {
  host: string;
  port: number;
  version?: string;
  accessible: boolean;
}

/**
 * GET /api/db/local-postgres/detect - Detect local PostgreSQL servers
 */
export async function GET() {
  const servers: LocalPostgresServer[] = [];
  const commonPorts = [5432, 5433, 5434, 5435];
  const hosts = ["localhost", "127.0.0.1"];

  // Try to detect PostgreSQL servers on common ports
  // Use Promise.allSettled to check all ports concurrently
  const detectionPromises: Promise<LocalPostgresServer | null>[] = [];
  
  for (const host of hosts) {
    for (const port of commonPorts) {
      detectionPromises.push(
        (async (): Promise<LocalPostgresServer | null> => {
          try {
            // Try connecting to postgres database (default database)
            const client = new Client({
              host,
              port,
              database: "postgres",
              user: process.env.USER || process.env.USERNAME || "postgres",
              password: "",
              connectionTimeoutMillis: 1000, // Quick timeout for detection
            });

            await client.connect();
            
            // Get version
            const versionResult = await client.query("SELECT version()");
            const version = versionResult.rows[0]?.version || "Unknown";
            
            await client.end();

            return {
              host,
              port,
              version,
              accessible: true,
            };
          } catch (error: any) {
            // Connection failed, but check if it's a PostgreSQL server (wrong credentials vs no server)
            if (error.code === "28P01" || error.message?.includes("password") || error.code === "ECONNREFUSED") {
              // Check if it's actually a PostgreSQL server by trying to connect with a different error
              // If we get authentication error, server exists
              if (error.code === "28P01" || error.message?.includes("password")) {
                return {
                  host,
                  port,
                  accessible: false,
                };
              }
            }
            // Otherwise, no server on this port
            return null;
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

  return NextResponse.json({ servers });
}
