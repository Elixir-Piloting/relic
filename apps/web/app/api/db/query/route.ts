import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeQuery } from "@/lib/db/connection";
import { analyzeQuery } from "@/lib/query/classifier";
import { DatabaseProvider, getProviderMetadata } from "@/lib/db/providers";
import { getCurrentConfig } from "@/lib/db/connection";

const QuerySchema = z.object({
  query: z.string().min(1),
  params: z.array(z.any()).optional(),
  dryRun: z.boolean().optional(),
  explain: z.boolean().optional(),
});

function isIntrospectionQuery(query: string): boolean {
  const upper = query.toUpperCase();
  return upper.includes("INFORMATION_SCHEMA") || upper.includes("PG_INDEXES");
}

async function handleSqliteIntrospectionQuery(query: string, params?: any[]): Promise<any[]> {
  // Params are [schema, table] - extract from positional params
  const table = params?.[1];
  const _schema = params?.[0];
  
  // Check what kind of introspection query
  const upper = query.toUpperCase();
  
  if (upper.includes("COLUMNS")) {
    const result = await executeQuery<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>(`PRAGMA table_info("${table}")`);
    
    return result.rows.map((r) => ({
      column_name: r.name,
      data_type: r.type || "TEXT",
      is_nullable: r.notnull === 0 ? "YES" : "NO",
      column_default: r.dflt_value,
      character_maximum_length: null,
      ordinal_position: r.cid + 1,
    }));
  }
  
  if (upper.includes("INDEXES") || upper.includes("PG_INDEXES")) {
    const result = await executeQuery<{
      name: string;
      unique: number;
    }>(`PRAGMA index_list("${table}")`);
    
    return result.rows.map((r) => ({
      indexname: r.name,
      indexdef: r.unique ? "UNIQUE" : "",
      tablename: table,
    }));
  }
  
  if (upper.includes("CONSTRAINT") || upper.includes("FOREIGN") || upper.includes("KEY")) {
    const result = await executeQuery<{
      id: number;
      seq: number;
      table: string;
      from: string;
      to: string;
    }>(`PRAGMA foreign_key_list("${table}")`);
    
    if (!result.rows.length) return [];
    
    return result.rows.map((r) => ({
      constraint_name: `fk_${r.table}_${r.seq}`,
      constraint_type: "FOREIGN KEY",
      table_schema: "main",
      table_name: table,
      column_name: r.from,
    }));
  }
  
  return [];
}

/**
 * POST /api/db/query - Execute a SQL query
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, params, dryRun, explain } = QuerySchema.parse(body);
    
    const config = getCurrentConfig();
    const provider = config?.provider;
    
    // Handle EXPLAIN queries
    if (explain || query.trim().toUpperCase().startsWith("EXPLAIN")) {
      let explainQuery = query;
      if (!query.trim().toUpperCase().startsWith("EXPLAIN")) {
        explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      }
      
      const result = await executeQuery(explainQuery, params);
      
      // Parse EXPLAIN plan
      if (result.rows && result.rows.length > 0) {
        const planData = result.rows[0];
        let planJson: any;
        
        if (typeof planData === "string") {
          planJson = JSON.parse(planData);
        } else if (planData["QUERY PLAN"]) {
          // Handle text format
          planJson = { plan: planData["QUERY PLAN"] };
        } else {
          planJson = planData;
        }
        
        return NextResponse.json({
          success: true,
          data: {
            plan: planJson,
            isExplain: true,
          },
        });
      }
    }
    
    // Handle dry-run for destructive queries (PostgreSQL only for now)
    if (dryRun && provider === DatabaseProvider.POSTGRESQL) {
      const analysis = analyzeQuery(query);
      if (analysis.isDestructive) {
        // For UPDATE/DELETE, try to estimate rows
        let estimatedRows: number | undefined;
        try {
          if (analysis.type === "UPDATE" || analysis.type === "DELETE") {
            // Create a COUNT query with the same WHERE clause
            const countQuery = query.replace(
              /^(UPDATE|DELETE)\s+.*?\s+SET/i,
              "SELECT COUNT(*) FROM"
            ).replace(/^DELETE\s+FROM/i, "SELECT COUNT(*) FROM");
            
            if (countQuery !== query) {
              const countResult = await executeQuery(countQuery, params);
              if (countResult.rows && countResult.rows.length > 0) {
                estimatedRows = Number(countResult.rows[0].count || countResult.rows[0].COUNT || 0);
              }
            }
          }
        } catch {
          // Ignore estimation errors
        }
        
        return NextResponse.json({
          success: true,
          data: {
            analysis: {
              ...analysis,
              estimatedRowsAffected: estimatedRows,
            },
            isDryRun: true,
          },
        });
      }
    }
    
    // Handle SQLite introspection queries
    if (provider === DatabaseProvider.SQLITE && isIntrospectionQuery(query)) {
      try {
        const rows = await handleSqliteIntrospectionQuery(query, params);
        return NextResponse.json({
          success: true,
          data: {
            rows,
            rowCount: rows.length,
            fields: rows.length > 0 ? Object.keys(rows[0]).map((name) => ({ name, dataTypeID: 0 })) : [],
          },
        });
      } catch (err) {
        return NextResponse.json({
          success: false,
          error: err instanceof Error ? err.message : "Introspection query failed for SQLite",
        }, { status: 500 });
      }
    }
    
    // Execute normal query
    const result = await executeQuery(query, params);
    
    return NextResponse.json({
      success: true,
      data: {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields.map((f) => ({
          name: f.name,
          dataTypeID: f.dataTypeID,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Query failed",
      },
      { status: 500 }
    );
  }
}
