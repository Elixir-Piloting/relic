/**
 * Database provider types and metadata
 */

export enum DatabaseProvider {
  POSTGRESQL = "postgresql",
  MYSQL = "mysql",
  MONGODB = "mongodb",
  SQLITE = "sqlite",
  LIBSQL = "libsql",
  SUPABASE = "supabase",
  PLANETSCALE = "planetscale",
}

export interface ProviderMetadata {
  id: DatabaseProvider;
  name: string;
  icon: string; // Icon path (PNG/SVG) or emoji fallback
  iconType?: "image" | "emoji"; // Whether to use image or emoji
  defaultPort: number;
  color: string;
  description: string;
  connectionType: "fields" | "url" | "file" | "fields-or-url";
  requiredFields?: string[];
  warning?: string;
  urlPlaceholder?: string; // Placeholder text for connection URL input
  urlProtocol?: string; // Expected URL protocol (e.g., "postgresql://", "mongodb+srv://")
}

export const PROVIDER_METADATA: Record<DatabaseProvider, ProviderMetadata> = {
  [DatabaseProvider.POSTGRESQL]: {
    id: DatabaseProvider.POSTGRESQL,
    name: "PostgreSQL",
    icon: "/icons/postgresql.png",
    iconType: "image",
    defaultPort: 5432,
    color: "#336791", // PostgreSQL blue
    description: "Advanced open-source relational database",
    connectionType: "fields-or-url",
    requiredFields: ["host", "database", "user"],
    urlPlaceholder: "postgresql://user:password@host:port/database",
    urlProtocol: "postgresql://",
  },
  [DatabaseProvider.MYSQL]: {
    id: DatabaseProvider.MYSQL,
    name: "MySQL",
    icon: "/icons/mysql.png",
    iconType: "image",
    defaultPort: 3306,
    color: "#F29111", // MySQL yellow/orange
    description: "Popular open-source relational database",
    connectionType: "fields-or-url",
    requiredFields: ["host", "database", "user"],
    urlPlaceholder: "mysql://user:password@host:port/database",
    urlProtocol: "mysql://",
  },
  [DatabaseProvider.MONGODB]: {
    id: DatabaseProvider.MONGODB,
    name: "MongoDB",
    icon: "/icons/mongodb.png",
    iconType: "image",
    defaultPort: 27017,
    color: "#001E2B", // MongoDB deep green/black
    description: "NoSQL document database",
    connectionType: "fields-or-url",
    requiredFields: ["host", "database", "user"],
    urlPlaceholder: "mongodb+srv://user:password@host/database",
    urlProtocol: "mongodb+srv://",
  },
  [DatabaseProvider.SQLITE]: {
    id: DatabaseProvider.SQLITE,
    name: "SQLite",
    icon: "/icons/sqlite.png",
    iconType: "image",
    defaultPort: 0, // File-based
    color: "#FFFFFF", // SQLite white
    description: "Embedded SQL database engine",
    connectionType: "file",
    requiredFields: ["filePath"],
  },
  [DatabaseProvider.LIBSQL]: {
    id: DatabaseProvider.LIBSQL,
    name: "LibSQL / Turso",
    icon: "/icons/turso.png",
    iconType: "image",
    defaultPort: 0, // HTTP-based
    color: "#000000", // Turso pure black
    description: "Edge SQL database powered by SQLite",
    connectionType: "url",
    requiredFields: ["connectionString"],
    urlPlaceholder: "libsql://host/database",
    urlProtocol: "libsql://",
  },
  [DatabaseProvider.SUPABASE]: {
    id: DatabaseProvider.SUPABASE,
    name: "Supabase",
    icon: "/icons/supabase.png",
    iconType: "image",
    defaultPort: 5432,
    color: "#000000", // Supabase pure black
    description: "Open-source Firebase alternative (PostgreSQL)",
    connectionType: "url",
    requiredFields: ["connectionString"],
    urlPlaceholder: "postgresql://user:password@host:port/database",
    urlProtocol: "postgresql://",
    warning: "IPv4 Compatibility Notice: Supabase direct connections require IPv6 support. If you're on an IPv4 network, use the Session Pooler connection string (port 6543) or purchase the IPv4 add-on from Supabase.",
  },
  [DatabaseProvider.PLANETSCALE]: {
    id: DatabaseProvider.PLANETSCALE,
    name: "PlanetScale PostgreSQL",
    icon: "/icons/planetscale.png",
    iconType: "image",
    defaultPort: 3306,
    color: "#000000", // PlanetScale pure black
    description: "Serverless PostgreSQL platform",
    connectionType: "url",
    requiredFields: ["connectionString"],
    urlPlaceholder: "mysql://user:password@host:port/database",
    urlProtocol: "mysql://",
  },
};

export function getProviderMetadata(provider: DatabaseProvider): ProviderMetadata {
  return PROVIDER_METADATA[provider];
}

export function getAllProviders(): ProviderMetadata[] {
  return Object.values(PROVIDER_METADATA);
}
