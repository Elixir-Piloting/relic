/**
 * Parse PostgreSQL EXPLAIN plans
 */

export interface PlanNode {
  "Node Type": string;
  "Startup Cost": number;
  "Total Cost": number;
  "Plan Rows": number;
  "Plan Width": number;
  "Actual Startup Time"?: number;
  "Actual Total Time"?: number;
  "Actual Rows"?: number;
  "Actual Loops"?: number;
  "Output"?: string[];
  "Filter"?: string;
  "Index Name"?: string;
  "Index Cond"?: string;
  "Join Type"?: string;
  "Hash Cond"?: string;
  "Merge Cond"?: string;
  "Sort Key"?: string[];
  "Sort Method"?: string;
  "Plans"?: PlanNode[];
}

export interface ParsedPlan {
  plan: PlanNode;
  planningTime?: number;
  executionTime?: number;
  totalCost: number;
  totalRows: number;
  warnings: string[];
}

/**
 * Parse JSON EXPLAIN plan
 */
export function parseExplainPlan(jsonPlan: any): ParsedPlan {
  const warnings: string[] = [];
  let plan: PlanNode;
  let planningTime: number | undefined;
  let executionTime: number | undefined;

  // Handle different EXPLAIN formats
  if (Array.isArray(jsonPlan) && jsonPlan.length > 0) {
    plan = jsonPlan[0].Plan || jsonPlan[0];
    if (jsonPlan[0]["Planning Time"]) {
      planningTime = jsonPlan[0]["Planning Time"];
    }
    if (jsonPlan[0]["Execution Time"]) {
      executionTime = jsonPlan[0]["Execution Time"];
    }
  } else if (jsonPlan.Plan) {
    plan = jsonPlan.Plan;
    planningTime = jsonPlan["Planning Time"];
    executionTime = jsonPlan["Execution Time"];
  } else {
    plan = jsonPlan;
  }

  // Calculate totals
  const totalCost = calculateTotalCost(plan);
  const totalRows = calculateTotalRows(plan);

  // Detect warnings
  if (hasSequentialScan(plan)) {
    warnings.push("Sequential scan detected - consider adding an index");
  }
  if (hasHighCost(plan, totalCost)) {
    warnings.push("High cost query - may be slow on large datasets");
  }

  return {
    plan,
    planningTime,
    executionTime,
    totalCost,
    totalRows,
    warnings,
  };
}

/**
 * Recursively calculate total cost
 */
function calculateTotalCost(node: PlanNode): number {
  let cost = node["Total Cost"] || 0;
  if (node.Plans) {
    for (const child of node.Plans) {
      cost = Math.max(cost, calculateTotalCost(child));
    }
  }
  return cost;
}

/**
 * Recursively calculate total rows
 */
function calculateTotalRows(node: PlanNode): number {
  let rows = node["Actual Rows"] || node["Plan Rows"] || 0;
  if (node.Plans) {
    for (const child of node.Plans) {
      rows += calculateTotalRows(child);
    }
  }
  return rows;
}

/**
 * Check if plan contains sequential scans
 */
function hasSequentialScan(node: PlanNode): boolean {
  if (node["Node Type"] === "Seq Scan") {
    return true;
  }
  if (node.Plans) {
    return node.Plans.some(hasSequentialScan);
  }
  return false;
}

/**
 * Check if plan has high cost
 */
function hasHighCost(node: PlanNode, totalCost: number): boolean {
  return totalCost > 1000; // Threshold for "high cost"
}

/**
 * Get node color based on performance
 */
export function getNodeColor(node: PlanNode): string {
  const cost = node["Total Cost"] || 0;
  const actualTime = node["Actual Total Time"] || 0;

  if (cost > 1000 || actualTime > 100) {
    return "text-red-400";
  } else if (cost > 100 || actualTime > 10) {
    return "text-yellow-400";
  } else {
    return "text-green-400";
  }
}

/**
 * Get node background color
 */
export function getNodeBgColor(node: PlanNode): string {
  const cost = node["Total Cost"] || 0;
  const actualTime = node["Actual Total Time"] || 0;

  if (cost > 1000 || actualTime > 100) {
    return "bg-red-500/10 border-red-500/20";
  } else if (cost > 100 || actualTime > 10) {
    return "bg-yellow-500/10 border-yellow-500/20";
  } else {
    return "bg-green-500/10 border-green-500/20";
  }
}
