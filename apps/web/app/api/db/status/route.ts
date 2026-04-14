import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/connection";
import { getCurrentConfig } from "@/lib/db/connection";
import { DatabaseProvider } from "@/lib/db/providers";

/**
 * GET /api/db/status - Check if database is connected
 */
export async function GET() {
  try {
    const adapter = getPool();
    if (!adapter || !adapter.isConnected()) {
      return NextResponse.json({ connected: false });
    }

    // Test the connection with a simple query based on provider
    const config = getCurrentConfig();
    if (config?.provider === DatabaseProvider.MONGODB) {
      // For MongoDB, try to ping
      // MongoDB adapter will handle this differently, but for now just check if connected
      // The isConnected() check above is sufficient
    } else {
      // For SQL databases, use SELECT 1
      await adapter.executeQuery("SELECT 1");
    }
    
    return NextResponse.json({ connected: true });
  } catch (error) {
    return NextResponse.json({ connected: false });
  }
}
