import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import { z } from "zod";

const CreateDatabaseSchema = z.object({
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string().optional(),
  databaseName: z.string().min(1, "Database name is required"),
});

/**
 * POST /api/db/local-postgres/create-db - Create a new database on a local PostgreSQL server
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { host, port, user, password, databaseName } = CreateDatabaseSchema.parse(body);

    // Connect to postgres database (default database) to create new database
    const client = new Client({
      host,
      port,
      database: "postgres", // Connect to default database
      user,
      password: password || "",
    });

    await client.connect();

    // Check if database already exists
    const checkResult = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName]
    );

    if (checkResult.rows.length > 0) {
      await client.end();
      return NextResponse.json(
        { error: `Database "${databaseName}" already exists` },
        { status: 400 }
      );
    }

    // Create the database
    // Note: CREATE DATABASE cannot be parameterized, so we need to validate the name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseName)) {
      await client.end();
      return NextResponse.json(
        { error: "Invalid database name. Only letters, numbers, and underscores are allowed." },
        { status: 400 }
      );
    }

    await client.query(`CREATE DATABASE "${databaseName}"`);
    await client.end();

    return NextResponse.json({
      success: true,
      message: `Database "${databaseName}" created successfully`,
    });
  } catch (error) {
    console.error("[Create DB API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create database";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
