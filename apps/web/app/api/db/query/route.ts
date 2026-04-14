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
