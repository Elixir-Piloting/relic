"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitBranch, Eye, Code } from "lucide-react";
import { parseExplainPlan, getNodeColor, getNodeBgColor, type PlanNode } from "@/lib/query/explain-parser";
import type { ParsedPlan } from "@/lib/query/explain-parser";
import { cn } from "@/lib/utils";

interface QueryPlanViewerProps {
  plan: any;
  className?: string;
}

export function QueryPlanViewer({ plan, className }: QueryPlanViewerProps) {
  const [viewMode, setViewMode] = useState<"visual" | "json">("visual");

  let parsedPlan: ParsedPlan;
  try {
    parsedPlan = parseExplainPlan(plan);
  } catch (error) {
    return (
      <div className={cn("p-4 text-sm text-muted-foreground", className)}>
        Failed to parse query plan: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "visual" | "json")} className="flex flex-col h-full">
        <TabsList className="w-full justify-start shrink-0">
          <TabsTrigger value="visual" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Visual
          </TabsTrigger>
          <TabsTrigger value="json" className="gap-2">
            <Code className="h-4 w-4" />
            JSON
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="flex-1 overflow-auto mt-4 min-h-0">
          <PlanTree node={parsedPlan.plan} level={0} />
          {parsedPlan.warnings.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <h4 className="text-sm font-medium text-yellow-400 mb-2">Warnings:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {parsedPlan.warnings.map((warning, i) => (
                  <li key={i}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
          {parsedPlan.planningTime !== undefined && (
            <div className="mt-4 text-sm text-muted-foreground">
              Planning Time: {parsedPlan.planningTime.toFixed(2)}ms
              {parsedPlan.executionTime !== undefined && (
                <> • Execution Time: {parsedPlan.executionTime.toFixed(2)}ms</>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="json" className="flex-1 overflow-hidden mt-4 min-h-0">
          <div className="h-full overflow-auto">
            <pre className="bg-muted p-4 rounded-md text-xs whitespace-pre-wrap break-words">
              {JSON.stringify(plan, null, 2)}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface PlanTreeProps {
  node: PlanNode;
  level: number;
}

function PlanTree({ node, level }: PlanTreeProps) {
  const [expanded, setExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const hasChildren = node.Plans && node.Plans.length > 0;

  // Try multiple possible keys for node type (use type assertion for dynamic access)
  const nodeAny = node as any;
  const nodeType = nodeAny["Node Type"] || nodeAny["node_type"] || nodeAny.nodeType || nodeAny.type || "Unknown";
  const cost = nodeAny["Total Cost"] || nodeAny["total_cost"] || nodeAny.totalCost || 0;
  const actualTime = nodeAny["Actual Total Time"] || nodeAny["actual_total_time"] || nodeAny.actualTotalTime || 0;
  const rows = nodeAny["Actual Rows"] || nodeAny["actual_rows"] || nodeAny.actualRows || nodeAny["Plan Rows"] || nodeAny["plan_rows"] || nodeAny.planRows || 0;

  return (
    <div className="relative">
      {/* Node */}
      <div
        className={cn(
          "p-3 rounded-md border mb-2 transition-colors",
          getNodeBgColor(node),
          level > 0 && "ml-8"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {hasChildren && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {expanded ? "▼" : "▶"}
                </button>
              )}
              <span className={cn("font-medium", getNodeColor(node))}>
                {nodeType}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Cost:</span> {cost.toFixed(2)}
              </div>
              {actualTime > 0 && (
                <div>
                  <span className="font-medium">Time:</span> {actualTime.toFixed(2)}ms
                </div>
              )}
              <div>
                <span className="font-medium">Rows:</span> {rows.toLocaleString()}
              </div>
              {node["Index Name"] && (
                <div>
                  <span className="font-medium">Index:</span> {node["Index Name"]}
                </div>
              )}
            </div>

            {/* Additional details */}
            {node.Filter && (
              <div className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium">Filter:</span> {node.Filter}
              </div>
            )}
            {node["Index Cond"] && (
              <div className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium">Index Cond:</span> {node["Index Cond"]}
              </div>
            )}
            {node["Join Type"] && (
              <div className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium">Join Type:</span> {node["Join Type"]}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.Plans!.map((child, i) => (
            <PlanTree key={i} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
