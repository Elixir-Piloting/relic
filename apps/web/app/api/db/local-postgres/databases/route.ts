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
  try {
    const body = await request.json();
    const { host, port, user, password } = ListDatabasesSchema.parse(body);

    // Connect to postgres database (default database) to list databases
    const client = new Client({
      host,
      port,
      database: "postgres", // Connect to default database
      user,
      password: password || "",
    });

    await client.connect();

    // List all databases (excluding system databases)
    const result = await client.query(`
      SELECT datname 
      FROM pg_database 
      WHERE datistemplate = false 
      AND datname NOT IN ('postgres', 'template0', 'template1')
      ORDER BY datname
    `);

    await client.end();

    const databases = result.rows.map((row) => row.datname);

    return NextResponse.json({
      success: true,
      databases,
    });
  } catch (error) {
    console.error("[List Databases API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to list databases";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
