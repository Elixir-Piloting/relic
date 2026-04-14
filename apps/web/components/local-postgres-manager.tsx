"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Server, Plus, Check, AlertCircle, Database, ChevronRight, ChevronDown, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import type { ConnectionConfig } from "@/lib/db/types";
import { DatabaseProvider } from "@/lib/db/providers";
import { Persistence } from "@/lib/persistence";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface LocalPostgresServer {
  host: string;
  port: number;
  version?: string;
  accessible: boolean;
  databases?: string[];
  expanded?: boolean;
  loadingDatabases?: boolean;
}

interface LocalPostgresManagerProps {
  onServerSelect: (config: ConnectionConfig) => void;
  onCreateDatabase: (config: ConnectionConfig) => void;
}

export function LocalPostgresManager({
  onServerSelect,
  onCreateDatabase,
}: LocalPostgresManagerProps) {
  const [servers, setServers] = useState<LocalPostgresServer[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [selectedServer, setSelectedServer] = useState<LocalPostgresServer | null>(null);
  const [showCreateDbDialog, setShowCreateDbDialog] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [dbUser, setDbUser] = useState(process.env.USER || process.env.USERNAME || "postgres");
  const [dbPassword, setDbPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [connectionName, setConnectionName] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordForServer, setPasswordForServer] = useState<LocalPostgresServer | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [tempUser, setTempUser] = useState(process.env.USER || process.env.USERNAME || "postgres");
  const [pendingDatabase, setPendingDatabase] = useState<string | null>(null);
  const [savePassword, setSavePassword] = useState(false);

  const detectServers = async () => {
    setIsDetecting(true);
    try {
      const response = await fetch("/api/db/local-postgres/detect");
      const data = await response.json();
      setServers(data.servers || []);
    } catch (error) {
      console.error("Failed to detect servers:", error);
      toast.error("Failed to detect local PostgreSQL servers");
    } finally {
      setIsDetecting(false);
    }
  };

  useEffect(() => {
    detectServers();
  }, []);

  // Load saved passwords and pre-populate user
  useEffect(() => {
    // Check if any server has saved password and pre-populate user field
    servers.forEach((server) => {
      if (!server.accessible) {
        const saved = Persistence.getServerPassword(server.host, server.port);
        if (saved && saved.user) {
          // Pre-populate user field if we have saved credentials
          setTempUser(saved.user);
        }
      }
    });
  }, [servers]);

  const handleCreateDatabase = async () => {
    if (!selectedServer || !newDbName.trim()) {
      toast.error("Please select a server and enter a database name");
      return;
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newDbName)) {
      toast.error("Invalid database name. Only letters, numbers, and underscores are allowed.");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/db/local-postgres/create-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: selectedServer.host,
          port: selectedServer.port,
          user: dbUser,
          password: dbPassword || undefined,
          databaseName: newDbName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create database");
      }

      toast.success(`Database "${newDbName}" created successfully`);

      // Create connection config and connect
      const config: ConnectionConfig = {
        id: `conn-${Date.now()}`,
        name: connectionName.trim() || `${selectedServer.host}:${selectedServer.port}/${newDbName}`,
        provider: DatabaseProvider.POSTGRESQL,
        host: selectedServer.host,
        port: selectedServer.port,
        database: newDbName.trim(),
        user: dbUser,
        password: dbPassword,
      };

      onCreateDatabase(config);
      setShowCreateDbDialog(false);
      setNewDbName("");
      setConnectionName("");
    } catch (error) {
      console.error("Failed to create database:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create database");
    } finally {
      setIsCreating(false);
    }
  };

  const loadDatabases = async (server: LocalPostgresServer, user: string, password: string) => {
    const serverIndex = servers.findIndex(
      (s) => s.host === server.host && s.port === server.port
    );
    if (serverIndex === -1) return;

    setServers((prev) => {
      const updated = [...prev];
      updated[serverIndex] = { ...updated[serverIndex], loadingDatabases: true };
      return updated;
    });

    try {
      const response = await fetch("/api/db/local-postgres/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: server.host,
          port: server.port,
          user,
          password: password || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load databases");
      }

      setServers((prev) => {
        const updated = [...prev];
        updated[serverIndex] = {
          ...updated[serverIndex],
          databases: data.databases || [],
          loadingDatabases: false,
        };
        return updated;
      });
    } catch (error) {
      console.error("Failed to load databases:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load databases");
      setServers((prev) => {
        const updated = [...prev];
        updated[serverIndex] = { ...updated[serverIndex], loadingDatabases: false };
        return updated;
      });
    }
  };

  const toggleServerExpanded = (server: LocalPostgresServer) => {
    const serverIndex = servers.findIndex(
      (s) => s.host === server.host && s.port === server.port
    );
    if (serverIndex === -1) return;

    const isExpanding = !server.expanded;
    
    setServers((prev) => {
      const updated = [...prev];
      updated[serverIndex] = { ...updated[serverIndex], expanded: isExpanding };
      return updated;
    });

    // Load databases when expanding
    if (isExpanding && !server.databases) {
      if (server.accessible) {
        // No password needed
        loadDatabases(server, dbUser, dbPassword);
      } else {
        // Check for saved password first
        const saved = Persistence.getServerPassword(server.host, server.port);
        if (saved) {
          // Use saved password
          loadDatabases(server, saved.user, saved.password);
        } else {
          // Need password - show dialog
          setPasswordForServer(server);
          // Check if we have saved credentials to pre-populate
          const saved = Persistence.getServerPassword(server.host, server.port);
          setTempPassword(saved?.password || "");
          setTempUser(saved?.user || process.env.USER || process.env.USERNAME || "postgres");
          setSavePassword(!!saved); // Pre-check if password is already saved
          setShowPasswordDialog(true);
        }
      }
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordForServer) return;
    
    // Save password if requested
    if (savePassword) {
      Persistence.setServerPassword(passwordForServer.host, passwordForServer.port, tempUser, tempPassword);
    }
    
    // If there's a pending database, connect directly
    if (pendingDatabase) {
      handleConnectToDatabase(passwordForServer, pendingDatabase, tempUser, tempPassword);
      setShowPasswordDialog(false);
      setPasswordForServer(null);
      setPendingDatabase(null);
      setSavePassword(false);
      return;
    }
    
    // Otherwise, just load databases
    await loadDatabases(passwordForServer, tempUser, tempPassword);
    setShowPasswordDialog(false);
    setPasswordForServer(null);
    setSavePassword(false);
  };

  const handleConnectToDatabase = (server: LocalPostgresServer, database: string, user?: string, password?: string) => {
    // Use provided credentials or try saved password
    let finalUser = user;
    let finalPassword = password;
    
    // If no credentials provided and server requires auth, check saved password
    if ((!finalUser || !finalPassword) && !server.accessible) {
      const saved = Persistence.getServerPassword(server.host, server.port);
      if (saved) {
        finalUser = saved.user;
        finalPassword = saved.password;
      } else {
        // Need password - show dialog
        setPasswordForServer(server);
        // Check if we have saved credentials to pre-populate
        const saved = Persistence.getServerPassword(server.host, server.port);
        setTempPassword(saved?.password || "");
        setTempUser(saved?.user || process.env.USER || process.env.USERNAME || "postgres");
        setPendingDatabase(database);
        setSavePassword(!!saved); // Pre-check if password is already saved
        setShowPasswordDialog(true);
        return;
      }
    }

    // Fallback to defaults if still no credentials
    finalUser = finalUser || dbUser;
    finalPassword = finalPassword || dbPassword;

    const config: ConnectionConfig = {
      id: `conn-${Date.now()}`,
      name: `${server.host}:${server.port}/${database}`,
      provider: DatabaseProvider.POSTGRESQL,
      host: server.host,
      port: server.port,
      database,
      user: finalUser,
      password: finalPassword,
    };

    onServerSelect(config);
  };

  const handleConnectToServer = (server: LocalPostgresServer) => {
    if (!server.accessible) {
      toast.error("This server requires authentication. Please expand to see databases.");
      return;
    }

    handleConnectToDatabase(server, "postgres");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Local PostgreSQL Servers</h3>
          <p className="text-xs text-muted-foreground">
            Automatically detect and connect to local PostgreSQL instances
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={detectServers}
          disabled={isDetecting}
          className={cn(
            isDetecting && "text-muted-foreground opacity-50"
          )}
        >
          {isDetecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Detecting...
            </>
          ) : (
            <>
              <Server className="mr-2 h-4 w-4" />
              Refresh
            </>
          )}
        </Button>
      </div>

      {servers.length === 0 && !isDetecting ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No local PostgreSQL servers detected. Make sure PostgreSQL is running and accessible.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {servers.map((server, index) => (
            <div key={`${server.host}-${server.port}-${index}`}>
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-3 flex-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => toggleServerExpanded(server)}
                  >
                    {server.expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  <Server className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">
                      {server.host}:{server.port}
                    </div>
                    {server.version && (
                      <div className="text-xs text-muted-foreground">{server.version}</div>
                    )}
                    {!server.accessible && (
                      <div className="text-xs text-yellow-600">
                        {Persistence.getServerPassword(server.host, server.port) 
                          ? "Password saved" 
                          : "Requires authentication"}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {server.accessible && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnectToServer(server)}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Connect
                    </Button>
                  )}
                  {!server.accessible && Persistence.getServerPassword(server.host, server.port) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        Persistence.removeServerPassword(server.host, server.port);
                        toast.success("Password removed");
                        // Reload databases if expanded
                        if (server.expanded) {
                          setServers((prev) => {
                            const updated = [...prev];
                            const idx = updated.findIndex((s) => s.host === server.host && s.port === server.port);
                            if (idx !== -1) {
                              updated[idx] = { ...updated[idx], databases: undefined };
                            }
                            return updated;
                          });
                        }
                      }}
                      title="Remove saved password"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setSelectedServer(server);
                      setShowCreateDbDialog(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create DB
                  </Button>
                </div>
              </div>
              
              {/* Database list */}
              {server.expanded && (
                <div className="ml-8 mt-1 space-y-1 border-l-2 border-border pl-2 max-h-[300px] overflow-y-auto">
                  {server.loadingDatabases ? (
                    <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading databases...
                    </div>
                  ) : server.databases && server.databases.length > 0 ? (
                    server.databases.map((db) => (
                      <div
                        key={db}
                        className="flex items-center justify-between p-2 rounded hover:bg-accent/30 transition-colors cursor-pointer group"
                        onClick={() => {
                          if (server.accessible) {
                            handleConnectToDatabase(server, db);
                          } else {
                            // Check for saved password first
                            const saved = Persistence.getServerPassword(server.host, server.port);
                            if (saved) {
                              // Use saved password
                              handleConnectToDatabase(server, db, saved.user, saved.password);
                            } else {
                              // Need password - show dialog
                              setPasswordForServer(server);
                              // Check if we have saved credentials to pre-populate
                              const saved = Persistence.getServerPassword(server.host, server.port);
                              setTempPassword(saved?.password || "");
                              setTempUser(saved?.user || process.env.USER || process.env.USERNAME || "postgres");
                              setPendingDatabase(db);
                              setSavePassword(!!saved); // Pre-check if password is already saved
                              setShowPasswordDialog(true);
                            }
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{db}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 h-6 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (server.accessible) {
                              handleConnectToDatabase(server, db);
                            } else {
                              // Check for saved password first
                              const saved = Persistence.getServerPassword(server.host, server.port);
                              if (saved) {
                                // Use saved password
                                handleConnectToDatabase(server, db, saved.user, saved.password);
                              } else {
                                // Need password - show dialog
                                setPasswordForServer(server);
                                // Check if we have saved credentials to pre-populate
                                const saved = Persistence.getServerPassword(server.host, server.port);
                                setTempPassword(saved?.password || "");
                                setTempUser(saved?.user || process.env.USER || process.env.USERNAME || "postgres");
                                setPendingDatabase(db);
                                setSavePassword(!!saved); // Pre-check if password is already saved
                                setShowPasswordDialog(true);
                              }
                            }
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">
                      No databases found
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreateDbDialog} onOpenChange={setShowCreateDbDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Database</DialogTitle>
            <DialogDescription>
              Create a new database on {selectedServer?.host}:{selectedServer?.port}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="connectionName">Connection Name</Label>
              <Input
                id="connectionName"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="My Local Database"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dbName">Database Name</Label>
              <Input
                id="dbName"
                value={newDbName}
                onChange={(e) => setNewDbName(e.target.value)}
                placeholder="mydatabase"
                pattern="[a-zA-Z_][a-zA-Z0-9_]*"
              />
              <p className="text-xs text-muted-foreground">
                Only letters, numbers, and underscores allowed
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dbUser">Username</Label>
              <Input
                id="dbUser"
                value={dbUser}
                onChange={(e) => setDbUser(e.target.value)}
                placeholder="postgres"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dbPassword">Password (optional)</Label>
              <Input
                id="dbPassword"
                type="password"
                value={dbPassword}
                onChange={(e) => setDbPassword(e.target.value)}
                placeholder="Leave empty if no password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDbDialog(false);
                setNewDbName("");
                setConnectionName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateDatabase} disabled={isCreating || !newDbName.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create & Connect
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Credentials</DialogTitle>
            <DialogDescription>
              Enter username and password to access {passwordForServer?.host}:{passwordForServer?.port}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tempUser">Username</Label>
              <Input
                id="tempUser"
                value={tempUser}
                onChange={(e) => setTempUser(e.target.value)}
                placeholder="postgres"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tempUser && tempPassword) {
                    handlePasswordSubmit();
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tempPassword">Password</Label>
              <Input
                id="tempPassword"
                type="password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Enter password"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tempUser && tempPassword) {
                    handlePasswordSubmit();
                  }
                }}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="savePassword"
                checked={savePassword}
                onCheckedChange={(checked) => setSavePassword(checked === true)}
              />
              <Label
                htmlFor="savePassword"
                className="text-sm font-normal cursor-pointer"
              >
                Save password for this server
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false);
                setPasswordForServer(null);
                setTempPassword("");
                setPendingDatabase(null);
                setSavePassword(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePasswordSubmit}
              disabled={!tempUser || !tempPassword}
            >
              {pendingDatabase ? "Connect" : "Load Databases"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
