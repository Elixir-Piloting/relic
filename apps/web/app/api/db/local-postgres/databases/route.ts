import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import { z } from "zod";

const ListDatabasesSchema = z.object({
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string().optional(),
});

/**
 * POST /api/db/local-postgres/databases - List databases on a PostgreSQL server
 */
export async function POST(request: NextRequest) {
  let client: Client | null = null;
  
  try {
    const body = await request.json();
    const { host, port, user, password } = ListDatabasesSchema.parse(body);

    client = new Client({
      host,
      port,
      database: "postgres",
      user,
      password: password || "",
      connectionTimeoutMillis: 5000,
    });

    await client.connect();

    const result = await client.query(`
      SELECT datname 
      FROM pg_database 
      WHERE datistemplate = false 
      AND datname NOT IN ('postgres', 'template0', 'template1')
      ORDER BY datname
    `);

    await client.end();
    client = null;

    return NextResponse.json({
      success: true,
      databases: result.rows.map((row) => row.datname),
    });
  } catch (error: any) {
    console.error("[List Databases API] Error:", error);
    
    if (client) {
      try { await client.end(); } catch {}
      client = null;
    }
    
    if (error.code === "53300") {
      return NextResponse.json(
        { error: "Server has too many connections. Try closing other PostgreSQL clients.", databases: [] },
        { status: 503 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to list databases";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
