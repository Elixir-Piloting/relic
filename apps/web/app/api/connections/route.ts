import { NextRequest, NextResponse } from "next/server";
import { DatabaseProvider } from "@/lib/db/providers";
import { z } from "zod";
import { ConnectionConfigSchema } from "@/lib/db/types";
import { connect, disconnect, getCurrentConfig } from "@/lib/db/connection";

const CreateConnectionSchema = ConnectionConfigSchema.omit({ id: true }).partial({ name: true });

/**
 * GET /api/connections - Get all saved connections
 * Note: In a real app, this would read from a secure server-side store
 */
export async function GET() {
  // For MVP, connections are stored client-side
  // This endpoint exists for future server-side storage
  return NextResponse.json({ connections: [] });
}

/**
 * POST /api/connections - Test a connection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[API] Received connection payload:', body);
    // Clean up fields not relevant for file‑based providers (e.g., SQLite)
    if (body.provider === DatabaseProvider.SQLITE) {
      // Remove fields that are required only for network providers
      delete body.host;
      delete body.port;
      delete body.database;
      delete body.user;
      delete body.password;
      delete body.connectionString;
    }
    const config = CreateConnectionSchema.parse(body);
    
    // Test connection
    const testConfig = {
      ...config,
      name: config.name || "Test Connection",
      id: "test-" + Date.now(),
    };
    
    await connect(testConfig);
    await disconnect();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid connection config", details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 }
    );
  }
}
