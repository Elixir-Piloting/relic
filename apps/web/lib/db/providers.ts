/**
 * Database provider types and metadata
 */

export enum DatabaseProvider {
  POSTGRESQL = "postgresql",
  MYSQL = "mysql",
  MARIADB = "mariadb",
  SQLSERVER = "sqlserver",
  CLICKHOUSE = "clickhouse",
  REDIS = "redis",
  MONGODB = "mongodb",
  SQLITE = "sqlite",
  LIBSQL = "libsql",
  VALTOWN = "valtown",
  CLOUDFLARED1 = "cloudflared1",
  SUPABASE = "supabase",
  PLANETSCALE = "planetscale",
  NEON = "neon",
}

export interface ProviderMetadata {
  id: DatabaseProvider;
  name: string;
  icon: string;
  iconType?: "image" | "emoji";
  defaultPort: number;
  color: string;
  description: string;
  connectionType: "fields" | "url" | "file" | "fields-or-url";
  requiredFields?: string[];
  warning?: string;
  urlPlaceholder?: string;
  urlProtocol?: string;
  connectionStringPatterns?: RegExp[];
}

export const PROVIDER_METADATA: Record<DatabaseProvider, ProviderMetadata> = {
  [DatabaseProvider.POSTGRESQL]: {
    id: DatabaseProvider.POSTGRESQL,
    name: "PostgreSQL",
    icon: "/icons/postgresql.png",
    iconType: "image",
    defaultPort: 5432,
    color: "#336791",
    description: "Advanced open-source relational database",
    connectionType: "fields-or-url",
    requiredFields: ["host", "database", "user"],
    urlPlaceholder: "postgresql://user:password@host:port/database",
    urlProtocol: "postgresql://",
    connectionStringPatterns: [/^postgresql: /i],
  },
  [DatabaseProvider.MYSQL]: {
    id: DatabaseProvider.MYSQL,
    name: "MySQL",
    icon: "/icons/mysql.png",
    iconType: "image",
    defaultPort: 3306,
    color: "#00758C",
    description: "Popular open-source relational database",
    connectionType: "fields-or-url",
    requiredFields: ["host", "database", "user"],
    urlPlaceholder: "mysql://user:password@host:port/database",
    urlProtocol: "mysql://",
    connectionStringPatterns: [/^mysql: /i],
  },
  [DatabaseProvider.MARIADB]: {
    id: DatabaseProvider.MARIADB,
    name: "MariaDB",
    icon: "/icons/mariadb.png",
    iconType: "image",
    defaultPort: 3306,
    color: "#1F2E54",
    description: "MySQL-compatible relational database",
    connectionType: "fields-or-url",
    requiredFields: ["host", "database", "user"],
    urlPlaceholder: "mysql://user:password@host:port/database",
    urlProtocol: "mysql://",
    connectionStringPatterns: [/^mysql: /i],
  },
  [DatabaseProvider.SQLSERVER]: {
    id: DatabaseProvider.SQLSERVER,
    name: "SQL Server",
    icon: "/icons/sqlserver.png",
    iconType: "image",
    defaultPort: 1433,
    color: "#CC2927",
    description: "Microsoft SQL Server",
    connectionType: "fields",
    requiredFields: ["host", "database", "user"],
    connectionStringPatterns: [/^Server= /i, /^Data Source= /i],
  },
  [DatabaseProvider.CLICKHOUSE]: {
    id: DatabaseProvider.CLICKHOUSE,
    name: "ClickHouse",
    icon: "/icons/clickhouse.png",
    iconType: "image",
    defaultPort: 9000,
    color: "#FFCE00",
    description: "Column-oriented analytical DB",
    connectionType: "fields-or-url",
    requiredFields: ["host", "database", "user"],
    urlPlaceholder: "clickhouse://user:password@host:port/database",
    urlProtocol: "clickhouse://",
    connectionStringPatterns: [/^clickhouse: /i],
  },
  [DatabaseProvider.REDIS]: {
    id: DatabaseProvider.REDIS,
    name: "Redis",
    icon: "/icons/redis.png",
    iconType: "image",
    defaultPort: 6379,
    color: "#DC382D",
    description: "In-memory data store",
    connectionType: "fields-or-url",
    requiredFields: ["host"],
    urlPlaceholder: "redis://user:password@host:port",
    urlProtocol: "redis://",
    connectionStringPatterns: [/^redis: /i],
  },
  [DatabaseProvider.MONGODB]: {
    id: DatabaseProvider.MONGODB,
    name: "MongoDB",
    icon: "/icons/mongodb.png",
    iconType: "image",
    defaultPort: 27017,
    color: "#001E2B",
    description: "NoSQL document database",
    connectionType: "fields-or-url",
    requiredFields: ["host", "database", "user"],
    urlPlaceholder: "mongodb+srv://user:password@host/database",
    urlProtocol: "mongodb+srv://",
    connectionStringPatterns: [/^mongodb\+?sr?v?: /i],
  },
  [DatabaseProvider.SQLITE]: {
    id: DatabaseProvider.SQLITE,
    name: "SQLite",
    icon: "/icons/sqlite.png",
    iconType: "image",
    defaultPort: 0,
    color: "#003545",
    description: "Embedded SQL database engine",
    connectionType: "file",
    requiredFields: ["filePath"],
    connectionStringPatterns: [/\.db$/, /\.sqlite$/, /\.sqlite3$/],
  },
  [DatabaseProvider.LIBSQL]: {
    id: DatabaseProvider.LIBSQL,
    name: "LibSQL / Turso",
    icon: "/icons/turso.png",
    iconType: "image",
    defaultPort: 0,
    color: "#000000",
    description: "Edge SQL database powered by SQLite",
    connectionType: "url",
    requiredFields: ["connectionString"],
    urlPlaceholder: "libsql://host/database",
    urlProtocol: "libsql://",
    connectionStringPatterns: [/^libsql: /i],
  },
  [DatabaseProvider.VALTOWN]: {
    id: DatabaseProvider.VALTOWN,
    name: "Val Town",
    icon: "/icons/valtown.png",
    iconType: "image",
    defaultPort: 0,
    color: "#8B5CF6",
    description: "Edge SQL (Val Town)",
    connectionType: "url",
    requiredFields: ["connectionString"],
    urlPlaceholder: "postgres://user:password@host/database",
    urlProtocol: "postgres://",
    connectionStringPatterns: [/^postgres: /i],
  },
  [DatabaseProvider.CLOUDFLARED1]: {
    id: DatabaseProvider.CLOUDFLARED1,
    name: "Cloudflare D1",
    icon: "/icons/cloudflare.png",
    iconType: "image",
    defaultPort: 0,
    color: "#F38020",
    description: "Edge SQLite (Cloudflare)",
    connectionType: "url",
    requiredFields: ["connectionString"],
    connectionStringPatterns: [/\.sqlite$/],
  },
  [DatabaseProvider.SUPABASE]: {
    id: DatabaseProvider.SUPABASE,
    name: "Supabase",
    icon: "/icons/supabase.png",
    iconType: "image",
    defaultPort: 5432,
    color: "#3ECF8E",
    description: "Open-source Firebase alternative (PostgreSQL)",
    connectionType: "url",
    requiredFields: ["connectionString"],
    urlPlaceholder: "postgresql://user:password@host:port/database",
    urlProtocol: "postgresql://",
    warning: "IPv4 Compatibility Notice: Supabase direct connections require IPv6 support. If you're on an IPv4 network, use the Session Pooler connection string (port 6543) or purchase the IPv4 add-on from Supabase.",
    connectionStringPatterns: [/^postgresql: /i, /supabase\.co/i],
  },
  [DatabaseProvider.PLANETSCALE]: {
    id: DatabaseProvider.PLANETSCALE,
    name: "PlanetScale",
    icon: "/icons/planetscale.png",
    iconType: "image",
    defaultPort: 3306,
    color: "#000000",
    description: "Serverless MySQL platform",
    connectionType: "url",
    requiredFields: ["connectionString"],
    urlPlaceholder: "mysql://user:password@host:port/database",
    urlProtocol: "mysql://",
    connectionStringPatterns: [/^mysql: /i, /planetscale\.com/i],
  },
  [DatabaseProvider.NEON]: {
    id: DatabaseProvider.NEON,
    name: "Neon",
    icon: "/icons/neon.png",
    iconType: "image",
    defaultPort: 5432,
    color: "#0FE5D3",
    description: "Serverless PostgreSQL",
    connectionType: "url",
    requiredFields: ["connectionString"],
    urlPlaceholder: "postgresql://user:password@host:port/database",
    urlProtocol: "postgresql://",
    connectionStringPatterns: [/^postgresql: /i, /neon\.tech/i],
  },
};

export function getProviderMetadata(provider: DatabaseProvider): ProviderMetadata {
  return PROVIDER_METADATA[provider];
}

export function getAllProviders(): ProviderMetadata[] {
  return Object.values(PROVIDER_METADATA);
}

export function detectProviderFromConnectionString(connectionString: string): DatabaseProvider | null {
  if (!connectionString) return null;
  
  const lower = connectionString.toLowerCase();
  
  // Check keyword/domain patterns first (more specific)
  // Neon
  if (lower.includes("neon.tech") || lower.includes("neondb")) {
    return DatabaseProvider.NEON;
  }
  // Supabase
  if (lower.includes("supabase.co") || lower.includes("pooler.supabase")) {
    return DatabaseProvider.SUPABASE;
  }
  // PlanetScale
  if (lower.includes("planetscale.com") || lower.includes("planetscale")) {
    return DatabaseProvider.PLANETSCALE;
  }
  // Cloudflare D1
  if (lower.includes("cloudflare") || lower.includes(".d1.")) {
    return DatabaseProvider.CLOUDFLARED1;
  }
  // Val Town
  if (lower.includes("val.town") || lower.includes("valtown")) {
    return DatabaseProvider.VALTOWN;
  }
  // LibSQL/Turso
  if (lower.includes("turso") || lower.includes("libsql")) {
    return DatabaseProvider.LIBSQL;
  }
  
  // Check protocol patterns
  if (lower.startsWith("postgresql://") || lower.startsWith("postgres://")) {
    // It's postgres protocol - check if it's actually neon/supabase by other signs
    if (lower.includes("db?") || lower.includes("database?")) {
      // Could be any postgres-compatible
      return DatabaseProvider.POSTGRESQL;
    }
    return DatabaseProvider.POSTGRESQL;
  }
  if (lower.startsWith("mysql://") || lower.startsWith("mariadb://")) {
    return lower.includes("mariadb") ? DatabaseProvider.MARIADB : DatabaseProvider.MYSQL;
  }
  if (lower.startsWith("mongodb") || lower.startsWith("mongodb+srv")) {
    return DatabaseProvider.MONGODB;
  }
  if (lower.startsWith("redis://")) {
    return DatabaseProvider.REDIS;
  }
  if (lower.startsWith("clickhouse://")) {
    return DatabaseProvider.CLICKHOUSE;
  }
  
  // Check file extensions for SQLite
  if (lower.endsWith(".db") || lower.endsWith(".sqlite") || lower.endsWith(".sqlite3")) {
    return DatabaseProvider.SQLITE;
  }
  // Check for file path pattern (contains / and ends with db-like name)
  if (/\/[^/]+\.(db|sqlite|sqlite3)$/.test(lower)) {
    return DatabaseProvider.SQLITE;
  }
  
  // Check SQL Server patterns
  if (lower.includes("server=") || lower.includes("data source=")) {
    return DatabaseProvider.SQLSERVER;
  }
  
  // Fallback: check for postgres name in URL
  if (lower.includes("postgres")) {
    return DatabaseProvider.POSTGRESQL;
  }
  
  // Default fallback - let the URL parser determine from protocol
  return null;
}
