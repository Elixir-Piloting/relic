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
    const firstItem = jsonPlan[0];
    plan = firstItem.Plan || firstItem.plan || firstItem;
    if (firstItem["Planning Time"] !== undefined) {
      planningTime = firstItem["Planning Time"];
    } else if (firstItem["planning_time"] !== undefined) {
      planningTime = firstItem["planning_time"];
    }
    if (firstItem["Execution Time"] !== undefined) {
      executionTime = firstItem["Execution Time"];
    } else if (firstItem["execution_time"] !== undefined) {
      executionTime = firstItem["execution_time"];
    }
  } else if (jsonPlan.Plan) {
    plan = jsonPlan.Plan;
    planningTime = jsonPlan["Planning Time"] ?? jsonPlan["planning_time"];
    executionTime = jsonPlan["Execution Time"] ?? jsonPlan["execution_time"];
  } else if (jsonPlan.plan) {
    plan = jsonPlan.plan;
    planningTime = jsonPlan["Planning Time"] ?? jsonPlan["planning_time"];
    executionTime = jsonPlan["Execution Time"] ?? jsonPlan["execution_time"];
  } else {
    plan = jsonPlan;
  }
  
  // Ensure plan has required structure
  if (!plan || typeof plan !== "object") {
    throw new Error("Invalid plan structure");
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
function calculateTotalCost(node: PlanNode | any): number {
  const cost = node["Total Cost"] || node["total_cost"] || node.totalCost || 0;
  let maxCost = cost;
  if (node.Plans || node.plans) {
    const plans = node.Plans || node.plans;
    for (const child of plans) {
      maxCost = Math.max(maxCost, calculateTotalCost(child));
    }
  }
  return maxCost;
}

/**
 * Recursively calculate total rows
 */
function calculateTotalRows(node: PlanNode | any): number {
  const rows = node["Actual Rows"] || node["actual_rows"] || node.actualRows || 
               node["Plan Rows"] || node["plan_rows"] || node.planRows || 0;
  let totalRows = rows;
  if (node.Plans || node.plans) {
    const plans = node.Plans || node.plans;
    for (const child of plans) {
      totalRows += calculateTotalRows(child);
    }
  }
  return totalRows;
}

/**
 * Check if plan contains sequential scans
 */
function hasSequentialScan(node: PlanNode | any): boolean {
  const nodeType = node["Node Type"] || node["node_type"] || node.nodeType || (node as any).type || "";
  if (nodeType === "Seq Scan" || nodeType === "seq_scan") {
    return true;
  }
  if (node.Plans || node.plans) {
    const plans = node.Plans || node.plans;
    return plans.some(hasSequentialScan);
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
export function getNodeColor(node: PlanNode | any): string {
  const cost = node["Total Cost"] || node["total_cost"] || node.totalCost || 0;
  const actualTime = node["Actual Total Time"] || node["actual_total_time"] || node.actualTotalTime || 0;

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
export function getNodeBgColor(node: PlanNode | any): string {
  const cost = node["Total Cost"] || node["total_cost"] || node.totalCost || 0;
  const actualTime = node["Actual Total Time"] || node["actual_total_time"] || node.actualTotalTime || 0;

  if (cost > 1000 || actualTime > 100) {
    return "bg-red-500/10 border-red-500/20";
  } else if (cost > 100 || actualTime > 10) {
    return "bg-yellow-500/10 border-yellow-500/20";
  } else {
    return "bg-green-500/10 border-green-500/20";
  }
}
