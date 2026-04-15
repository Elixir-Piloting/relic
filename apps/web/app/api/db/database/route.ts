import { NextRequest, NextResponse } from "next/server";
import { getSchemas } from "@/lib/schema/introspect";
import { getPool, getCurrentConfig, connect } from "@/lib/db/connection";

/**
 * GET /api/db/database - Get all databases
 */
export async function GET() {
  let adapter = getPool();

  if (adapter && !adapter.isConnected()) {
    const config = getCurrentConfig();
    if (config) {
      try {
        await connect(config);
        adapter = getPool();
      } catch {
        adapter = null;
      }
    }
  }

  if (!adapter || !adapter.isConnected()) {
    return NextResponse.json({ databases: [] });
  }

  try {
    const databases = await getSchemas();
    return NextResponse.json({ databases });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch databases";

    if (
      errorMessage.includes("No database connection") ||
      errorMessage.includes("closed") ||
      errorMessage.includes("not queryable") ||
      errorMessage.includes("Connection terminated")
    ) {
      return NextResponse.json({ databases: [] });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}