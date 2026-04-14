import { NextRequest, NextResponse } from "next/server";
import { ConnectionConfigSchema } from "@/lib/db/types";
import { connect, disconnect, getPool } from "@/lib/db/connection";

/**
 * POST /api/db/connect - Connect to a database
 */
export async function POST(request: NextRequest) {
  try {
    console.log("[Connect API] Starting connection request...");
    const body = await request.json();
    console.log("[Connect API] Request body received:", { ...body, password: body.password ? "***" : "missing" });
    
    const config = ConnectionConfigSchema.parse(body);
    console.log("[Connect API] Config validated:", { ...config, password: "***" });
    
    // Disconnect any existing connection
    console.log("[Connect API] Disconnecting existing connection...");
    await disconnect();
    console.log("[Connect API] Existing connection disconnected");
    
    // Connect to new database
    console.log("[Connect API] Connecting to database...", { host: config.host, port: config.port, database: config.database, user: config.user });
    await connect(config);
    console.log("[Connect API] Connection successful");
    
    // Verify the pool exists after connection
    const pool = getPool();
    console.log("[Connect API] Pool verification after connect:", pool ? "EXISTS" : "NULL");
    if (!pool) {
      throw new Error("Connection pool was not created");
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Connect API] Error occurred:", error);
    console.error("[Connect API] Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    
    await disconnect().catch((disconnectError) => {
      console.error("[Connect API] Error during disconnect cleanup:", disconnectError);
    });
    
    const errorMessage = error instanceof Error ? error.message : "Connection failed";
    
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/db/connect - Disconnect from database
 */
export async function DELETE() {
  try {
    await disconnect();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Disconnect failed",
      },
      { status: 500 }
    );
  }
}
