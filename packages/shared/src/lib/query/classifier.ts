/**
 * Query classification and safety analysis
 */

export enum QueryType {
  SELECT = "SELECT",
  INSERT = "INSERT",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  TRUNCATE = "TRUNCATE",
  DROP = "DROP",
  ALTER = "ALTER",
  CREATE = "CREATE",
  EXPLAIN = "EXPLAIN",
  OTHER = "OTHER",
}

export enum QueryRisk {
  SAFE = "SAFE",
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export interface QueryAnalysis {
  type: QueryType;
  risk: QueryRisk;
  isDestructive: boolean;
  requiresWhere: boolean;
  hasWhere: boolean;
  tables: string[];
  estimatedRowsAffected?: number;
  locksExpected?: string[];
}

/**
 * Parse SQL to extract basic information
 */
function parseSQL(query: string): {
  type: QueryType;
  tables: string[];
  hasWhere: boolean;
} {
  const normalized = query.trim().toUpperCase();
  const lines = query.split("\n").map((l) => l.trim());

  // Determine query type
  let type: QueryType = QueryType.OTHER;
  if (normalized.startsWith("SELECT")) type = QueryType.SELECT;
  else if (normalized.startsWith("INSERT")) type = QueryType.INSERT;
  else if (normalized.startsWith("UPDATE")) type = QueryType.UPDATE;
  else if (normalized.startsWith("DELETE")) type = QueryType.DELETE;
  else if (normalized.startsWith("TRUNCATE")) type = QueryType.TRUNCATE;
  else if (normalized.startsWith("DROP")) type = QueryType.DROP;
  else if (normalized.startsWith("ALTER")) type = QueryType.ALTER;
  else if (normalized.startsWith("CREATE")) type = QueryType.CREATE;
  else if (normalized.startsWith("EXPLAIN")) type = QueryType.EXPLAIN;

  // Extract table names (simplified - works for most common cases)
  const tables: string[] = [];
  const tablePatterns = [
    /FROM\s+["`]?(\w+)["`]?/gi,
    /UPDATE\s+["`]?(\w+)["`]?/gi,
    /INTO\s+["`]?(\w+)["`]?/gi,
    /TRUNCATE\s+["`]?(\w+)["`]?/gi,
    /DROP\s+TABLE\s+["`]?(\w+)["`]?/gi,
    /ALTER\s+TABLE\s+["`]?(\w+)["`]?/gi,
  ];

  for (const pattern of tablePatterns) {
    const matches = query.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !tables.includes(match[1])) {
        tables.push(match[1]);
      }
    }
  }

  // Check for WHERE clause
  const hasWhere = /\bWHERE\b/i.test(query);

  return { type, tables, hasWhere };
}

/**
 * Analyze a query for safety
 */
export function analyzeQuery(query: string): QueryAnalysis {
  const { type, tables, hasWhere } = parseSQL(query);

  // Determine if destructive
  const destructiveTypes = [
    QueryType.UPDATE,
    QueryType.DELETE,
    QueryType.TRUNCATE,
    QueryType.DROP,
    QueryType.ALTER,
  ];
  const isDestructive = destructiveTypes.includes(type);

  // Determine if WHERE is required
  const requiresWhere = type === QueryType.UPDATE || type === QueryType.DELETE;

  // Determine risk level
  let risk: QueryRisk = QueryRisk.SAFE;
  if (type === QueryType.SELECT || type === QueryType.EXPLAIN) {
    risk = QueryRisk.SAFE;
  } else if (type === QueryType.INSERT) {
    risk = QueryRisk.LOW;
  } else if (type === QueryType.UPDATE || type === QueryType.DELETE) {
    if (hasWhere) {
      risk = QueryRisk.MEDIUM;
    } else {
      risk = QueryRisk.HIGH;
    }
  } else if (type === QueryType.TRUNCATE || type === QueryType.ALTER) {
    risk = QueryRisk.HIGH;
  } else if (type === QueryType.DROP) {
    risk = QueryRisk.CRITICAL;
  }

  // Estimate locks (best-effort)
  const locksExpected: string[] = [];
  if (isDestructive) {
    locksExpected.push("Row-level locks on affected tables");
    if (type === QueryType.TRUNCATE || type === QueryType.DROP) {
      locksExpected.push("Exclusive table lock");
    }
  }

  return {
    type,
    risk,
    isDestructive,
    requiresWhere,
    hasWhere,
    tables,
    locksExpected,
  };
}

/**
 * Check if query should be blocked by Safe Mode
 */
export function shouldBlockQuery(analysis: QueryAnalysis, safeModeEnabled: boolean): {
  blocked: boolean;
  reason?: string;
} {
  if (!safeModeEnabled) {
    return { blocked: false };
  }

  if (!analysis.isDestructive) {
    return { blocked: false };
  }

  // Block UPDATE/DELETE without WHERE
  if (analysis.requiresWhere && !analysis.hasWhere) {
    return {
      blocked: true,
      reason: `${analysis.type} queries require a WHERE clause when Safe Mode is enabled`,
    };
  }

  // All destructive queries need confirmation, but not blocked
  return { blocked: false };
}
