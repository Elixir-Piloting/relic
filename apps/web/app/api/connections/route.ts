import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ConnectionConfigSchema } from "@/lib/db/types";
import { connect, disconnect, getCurrentConfig } from "@/lib/db/connection";

const CreateConnectionSchema = ConnectionConfigSchema.omit({ id: true });

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
    const config = CreateConnectionSchema.parse(body);
    
    // Test connection
    const testConfig = {
      ...config,
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
