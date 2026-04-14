import { NextRequest, NextResponse } from "next/server";
import {
  getTableRelationships,
  getReferencingTables,
} from "@/lib/schema/relationships";
import { getPool } from "@/lib/db/connection";

/**
 * GET /api/db/relationships - Get table relationships
 */
export async function GET(request: NextRequest) {
  try {
    // Check adapter status before proceeding
    const adapter = getPool();
    if (!adapter || !adapter.isConnected()) {
      return NextResponse.json({ relationships: [] });
    }

    const searchParams = request.nextUrl.searchParams;
    const schema = searchParams.get("schema");
    const table = searchParams.get("table");
    const type = searchParams.get("type") || "outgoing";

    if (!schema || !table) {
      return NextResponse.json(
        { error: "Schema and table are required" },
        { status: 400 }
      );
    }

    let relationships;
    if (type === "outgoing") {
      relationships = await getTableRelationships(schema, table);
    } else {
      relationships = await getReferencingTables(schema, table);
    }

    return NextResponse.json({ relationships });
  } catch (error) {
    // Return empty relationships instead of error for better UX
    console.error("[Relationships API] Error:", error);
    return NextResponse.json({ relationships: [] });
  }
}
