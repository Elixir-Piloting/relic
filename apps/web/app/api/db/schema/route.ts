import { NextRequest, NextResponse } from "next/server";
import { getSchemas, getTables } from "@/lib/schema/introspect";
import { getPool, getCurrentConfig, connect } from "@/lib/db/connection";

/**
 * GET /api/db/schema - Get all schemas
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const schema = searchParams.get("schema");
  
  console.log("[Schema API] GET request received, schema param:", schema);
  
  // Check adapter status before proceeding
  let adapter = getPool();
  console.log("[Schema API] Adapter status:", adapter ? "EXISTS" : "NULL");
  
  // If adapter exists but is not connected, try to reconnect
  if (adapter && !adapter.isConnected()) {
    console.log("[Schema API] Adapter exists but not connected, attempting to reconnect...");
    const config = getCurrentConfig();
    if (config) {
      try {
        await connect(config);
        adapter = getPool();
        console.log("[Schema API] Reconnection successful:", adapter ? "EXISTS" : "NULL");
      } catch (reconnectError) {
        console.error("[Schema API] Reconnection failed:", reconnectError);
        adapter = null;
      }
    } else {
      console.log("[Schema API] No config available for reconnection");
      adapter = null;
    }
  }
  
  if (!adapter || !adapter.isConnected()) {
    console.log("[Schema API] No adapter available or not connected, returning empty schemas");
    if (schema) {
      return NextResponse.json({ tables: [] });
    }
    return NextResponse.json({ schemas: [] });
  }
  
  try {
    if (schema) {
      console.log("[Schema API] Fetching tables for schema:", schema);
      const tables = await getTables(schema);
      console.log("[Schema API] Tables for schema", schema, ":", tables.length, "tables", tables);
      return NextResponse.json({ tables });
    }
    
    console.log("[Schema API] Fetching all schemas...");
    const schemas = await getSchemas();
    console.log("[Schema API] Found schemas:", schemas, "count:", schemas.length);
    const response = { schemas };
    console.log("[Schema API] Returning response:", JSON.stringify(response));
    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch schema";
    console.error("[Schema API] Error:", errorMessage);
    
    // If no connection or client closed, return empty arrays instead of error
    if (
      errorMessage.includes("No database connection") || 
      errorMessage.includes("connect") ||
      errorMessage.includes("closed") ||
      errorMessage.includes("not queryable") ||
      errorMessage.includes("Connection terminated") ||
      errorMessage.includes("terminated")
    ) {
      console.log("[Schema API] Connection issue detected, returning empty arrays");
      if (schema) {
        return NextResponse.json({ tables: [] });
      }
      return NextResponse.json({ schemas: [] });
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
