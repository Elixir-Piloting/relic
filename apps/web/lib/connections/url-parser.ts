/**
 * Parse database connection URL into connection config
 * Supports formats:
 * - PostgreSQL: postgresql://user:password@host:port/database
 * - MySQL: mysql://user:password@host:port/database
 * - MongoDB: mongodb://user:password@host:port/database
 * - MongoDB Atlas: mongodb+srv://user:password@host/database
 * - SQLite: sqlite:///path/to/database.db
 * - LibSQL/Turso: libsql://host/database
 */

import { DatabaseProvider } from "@/lib/db/providers";

export interface ParsedConnectionURL {
  provider?: DatabaseProvider;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  isSupabase?: boolean;
  isSessionPooler?: boolean;
}

export function parseConnectionURL(url: string): ParsedConnectionURL {
  // Remove any whitespace
  url = url.trim();

  // Check if it's a Supabase connection string
  const isSupabase = url.includes("supabase") || url.includes("pooler.supabase");
  const isSessionPooler = url.includes("pooler.supabase") || url.includes(":6543");

  // Detect database type from URL protocol
  const isMongoDB = url.startsWith("mongodb://") || url.startsWith("mongodb+srv://");
  const isMySQL = url.startsWith("mysql://");
  const isPostgreSQL = url.startsWith("postgresql://") || url.startsWith("postgres://");
  const isSQLite = url.startsWith("sqlite://");
  const isLibSQL = url.startsWith("libsql://");

  // MongoDB SRV format (mongodb+srv://) doesn't use ports
  if (isMongoDB && url.startsWith("mongodb+srv://")) {
    return parseMongoDBSRV(url);
  }

  // Check if password likely contains unencoded @ - if so, use manual parsing
  // URL constructor will fail with unencoded @ in passwords
  // Pattern: if there are multiple @ signs, password likely contains @
  // Count @ signs - if more than 1, password contains @
  const atCount = (url.match(/@/g) || []).length;
  const hasUnencodedAt = atCount > 1;
  
  if (!hasUnencodedAt) {
    // Try to parse using URL constructor first (handles URL encoding properly)
    try {
      // Replace database protocol with http:// temporarily for URL parsing
      // This handles URL-encoded characters in passwords properly
      let tempUrl = url;
      if (isPostgreSQL) {
        tempUrl = url.replace(/^(postgresql|postgres):\/\//, "http://");
      } else if (isMySQL) {
        tempUrl = url.replace(/^mysql:\/\//, "http://");
      } else if (isMongoDB) {
        tempUrl = url.replace(/^mongodb:\/\//, "http://");
      } else if (isLibSQL) {
        tempUrl = url.replace(/^libsql:\/\//, "http://");
      } else {
        throw new Error("Unsupported database URL format");
      }
      
      const parsedUrl = new URL(tempUrl);
      
      const host = parsedUrl.hostname;
      const portStr = parsedUrl.port;
      const pathname = parsedUrl.pathname;
      const searchParams = parsedUrl.searchParams;
      
      // Extract user and password - URL constructor handles URL encoding
      const user = parsedUrl.username ? decodeURIComponent(parsedUrl.username) : "";
      const password = parsedUrl.password ? decodeURIComponent(parsedUrl.password) : "";
      
      // Database is the pathname without leading slash
      const database = pathname.replace(/^\//, "").split("?")[0];
      
      // Get SSL mode from query string
      const sslMode = searchParams.get("sslmode") || searchParams.get("ssl_mode");
      const ssl = sslMode === "require" || sslMode === "prefer" || searchParams.get("ssl") === "true" || isMongoDB || isSupabase;
      
      // Default ports based on database type
      let defaultPort = 5432; // PostgreSQL default
      if (isMySQL) defaultPort = 3306;
      else if (isMongoDB) defaultPort = 27017;
      
      const port = portStr ? parseInt(portStr, 10) : defaultPort;
      
      if (!host) {
        throw new Error("Missing required connection parameters (host)");
      }

      let provider: DatabaseProvider = DatabaseProvider.POSTGRESQL;
      if (isMySQL) provider = DatabaseProvider.MYSQL;
      else if (isMongoDB) provider = DatabaseProvider.MONGODB;
      else if (isLibSQL) provider = DatabaseProvider.LIBSQL;
      
      return {
        provider,
        host: decodeURIComponent(host),
        port,
        database: database ? decodeURIComponent(database) : "",
        user,
        password,
        ssl: ssl || isSupabase,
        isSupabase,
        isSessionPooler,
      };
    } catch (urlError) {
      // Fall through to manual parsing
    }
  }
  
  // Manual parsing - handles passwords with unencoded @ characters
  {
    // Fallback: Manually parse if URL constructor fails
    // This handles cases where passwords contain unencoded special characters like @
    // Strategy: Start from the end, find the first @ going backwards (before the host)
    
    // Match different database protocols
    const protocolMatch = url.match(/^(postgresql|postgres|mysql|mongodb|libsql):\/\//);
    if (!protocolMatch) {
      throw new Error("Invalid connection URL format. Supported: postgresql://, mysql://, mongodb://, libsql://");
    }
    
    const protocol = protocolMatch[1];
    const afterProtocol = url.substring(protocolMatch[0].length);
    
    // Find the first / (which marks the database) - MongoDB might not have it
    const dbSlashIndex = afterProtocol.indexOf('/');
    let beforeDb: string;
    let afterDb: string;
    let database = "";
    let queryString = "";
    
    if (dbSlashIndex === -1) {
      // No database specified (MongoDB allows this)
      beforeDb = afterProtocol;
      afterDb = "";
    } else {
      beforeDb = afterProtocol.substring(0, dbSlashIndex);
      afterDb = afterProtocol.substring(dbSlashIndex + 1);
      
      // Split query string
      [database, queryString = ""] = afterDb.split('?');
    }
    
    // Find the last @ in beforeDb - this separates credentials from host:port
    // Start from the end and work backwards to find the @ that separates credentials from host
    const lastAt = beforeDb.lastIndexOf('@');
    
    let user = "";
    let password = "";
    let hostPort = beforeDb;
    
    if (lastAt !== -1) {
      // Everything before the last @ is credentials (user:password)
      const credentials = beforeDb.substring(0, lastAt);
      // Everything after the last @ is host:port
      hostPort = beforeDb.substring(lastAt + 1);
      
      // Split credentials on the first : only (password can contain : too)
      const colonIndex = credentials.indexOf(':');
      if (colonIndex !== -1) {
        user = credentials.substring(0, colonIndex);
        // Password is everything after the first : (can contain @, :, etc.)
        password = credentials.substring(colonIndex + 1);
      } else {
        user = credentials;
      }
    }
    
    // Parse host and port
    const [host, portStr = ""] = hostPort.split(':');
    
    // Default ports based on database type
    let defaultPort = 5432; // PostgreSQL default
    if (protocol === "mysql") defaultPort = 3306;
    else if (protocol === "mongodb") defaultPort = 27017;
    
    const port = portStr ? parseInt(portStr, 10) : defaultPort;
    
    // Decode URL-encoded values
    const decodedUser = user ? decodeURIComponent(user) : "";
    const decodedPassword = password ? decodeURIComponent(password) : "";
    const decodedHost = host ? decodeURIComponent(host) : "";
    const decodedDatabase = database ? decodeURIComponent(database) : "";
    
    // Parse query string for SSL
    const params = new URLSearchParams(queryString);
    const sslMode = params.get("sslmode") || params.get("ssl_mode");
    const ssl = sslMode === "require" || sslMode === "prefer" || params.get("ssl") === "true" || protocol === "mongodb" || isSupabase;
    
    if (!decodedHost) {
      throw new Error("Missing required connection parameters (host)");
    }
    
    let provider: DatabaseProvider = DatabaseProvider.POSTGRESQL;
    if (protocol === "mysql") provider = DatabaseProvider.MYSQL;
    else if (protocol === "mongodb") provider = DatabaseProvider.MONGODB;
    else if (protocol === "libsql") provider = DatabaseProvider.LIBSQL;
    
    return {
      provider,
      host: decodedHost,
      port,
      database: decodedDatabase,
      user: decodedUser,
      password: decodedPassword,
      ssl: ssl || isSupabase,
      isSupabase,
      isSessionPooler,
    };
  }
}

/**
 * Parse MongoDB SRV connection string (mongodb+srv://)
 */
function parseMongoDBSRV(url: string): ParsedConnectionURL {
  // Format: mongodb+srv://user:password@host/database?options
  const protocolMatch = url.match(/^mongodb\+srv:\/\//);
  if (!protocolMatch) {
    throw new Error("Invalid MongoDB SRV URL format");
  }
  
  const afterProtocol = url.substring(protocolMatch[0].length);
  
  // Find the first / (which marks the database)
  const dbSlashIndex = afterProtocol.indexOf('/');
  let beforeDb: string;
  let afterDb: string;
  let database = "";
  let queryString = "";
  
  if (dbSlashIndex === -1) {
    beforeDb = afterProtocol;
    afterDb = "";
  } else {
    beforeDb = afterProtocol.substring(0, dbSlashIndex);
    afterDb = afterProtocol.substring(dbSlashIndex + 1);
    [database, queryString = ""] = afterDb.split('?');
  }
  
  // Find the last @ in beforeDb
  const lastAt = beforeDb.lastIndexOf('@');
  
  let user = "";
  let password = "";
  let host = beforeDb;
  
  if (lastAt !== -1) {
    const credentials = beforeDb.substring(0, lastAt);
    host = beforeDb.substring(lastAt + 1);
    
    const colonIndex = credentials.indexOf(':');
    if (colonIndex !== -1) {
      user = credentials.substring(0, colonIndex);
      password = credentials.substring(colonIndex + 1);
    } else {
      user = credentials;
    }
  }
  
  // Decode URL-encoded values
  const decodedUser = user ? decodeURIComponent(user) : "";
  const decodedPassword = password ? decodeURIComponent(password) : "";
  const decodedHost = host ? decodeURIComponent(host) : "";
  const decodedDatabase = database ? decodeURIComponent(database) : "";
  
  // MongoDB SRV always uses SSL
  return {
    provider: DatabaseProvider.MONGODB,
    host: decodedHost,
    port: 27017, // MongoDB default (SRV doesn't specify port)
    database: decodedDatabase,
    user: decodedUser,
    password: decodedPassword,
    ssl: true,
    isSupabase: false,
    isSessionPooler: false,
  };
}

export function buildConnectionURL(config: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}): string {
  const { host, port, database, user, password, ssl } = config;
  
  // URL encode values
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const encodedHost = encodeURIComponent(host);
  const encodedDatabase = encodeURIComponent(database);

  let url = `postgresql://${encodedUser}:${encodedPassword}@${encodedHost}:${port}/${encodedDatabase}`;
  
  if (ssl) {
    url += "?sslmode=require";
  }

  return url;
}
