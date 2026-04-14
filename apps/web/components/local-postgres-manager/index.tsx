"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Server } from "lucide-react";
import { toast } from "sonner";
import type { ConnectionConfig } from "@/lib/db/types";
import { DatabaseProvider } from "@/lib/db/providers";
import { Persistence } from "@/lib/persistence";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { LocalPostgresServer, LocalPostgresManagerProps } from "./types";
import { ServerList } from "./ServerList";

export function LocalPostgresManager({
  onServerSelect,
  onCreateDatabase,
}: LocalPostgresManagerProps) {
  const [servers, setServers] = useState<LocalPostgresServer[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [selectedServer, setSelectedServer] = useState<LocalPostgresServer | null>(null);
  const [showCreateDbDialog, setShowCreateDbDialog] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [dbUser, setDbUser] = useState(process.env.USER || "postgres");
  const [dbPassword, setDbPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [connectionName, setConnectionName] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordForServer, setPasswordForServer] = useState<LocalPostgresServer | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [tempUser, setTempUser] = useState(process.env.USER || "postgres");
  const [pendingDatabase, setPendingDatabase] = useState<string | null>(null);
  const [savePassword, setSavePassword] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<{
    server: LocalPostgresServer;
    database: string;
    user?: string;
    password?: string;
  } | null>(null);
  const [connectionNameToSave, setConnectionNameToSave] = useState("");

  const detectServers = async () => {
    setIsDetecting(true);
    try {
      const response = await fetch("/api/db/local-postgres/detect");
      const data = await response.json();
      console.log("Detected servers:", data.servers);
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
        body: JSON.stringify({ host: server.host, port: server.port, user, password }),
      });
      const data = await response.json();

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
      setServers((prev) => {
        const updated = [...prev];
        updated[serverIndex] = { ...updated[serverIndex], loadingDatabases: false };
        return updated;
      });
    }
  };

  const handleExpand = (server: LocalPostgresServer) => {
    const idx = servers.findIndex((s) => s.host === server.host && s.port === server.port);
    if (idx === -1) return;

    const isExpanding = !server.expanded;
    setServers((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], expanded: isExpanding };
      return updated;
    });

    if (isExpanding && !server.databases) {
      if (server.accessible) {
        loadDatabases(server, dbUser, dbPassword);
      } else {
        const saved = Persistence.getServerPassword(server.host, server.port);
        setTempPassword(saved?.password || "");
        setTempUser(saved?.user || process.env.USER || "postgres");
        setPasswordForServer(server);
        setSavePassword(!!saved);
        setShowPasswordDialog(true);
      }
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordForServer) return;

    if (savePassword) {
      Persistence.setServerPassword(
        passwordForServer.host,
        passwordForServer.port,
        tempUser,
        tempPassword
      );
    }

    if (pendingDatabase) {
      handleConnectToDatabase(passwordForServer, pendingDatabase, tempUser, tempPassword);
      setShowPasswordDialog(false);
      setPasswordForServer(null);
      setPendingDatabase(null);
      setSavePassword(false);
      return;
    }

    await loadDatabases(passwordForServer, tempUser, tempPassword);
    setShowPasswordDialog(false);
    setPasswordForServer(null);
    setSavePassword(false);
  };

  const handleConnectToDatabase = (
    server: LocalPostgresServer,
    database: string,
    user?: string,
    password?: string
  ) => {
    let finalUser = user;
    let finalPassword = password;

    if ((!finalUser || !finalPassword) && !server.accessible) {
      const saved = Persistence.getServerPassword(server.host, server.port);
      if (saved) {
        finalUser = saved.user;
        finalPassword = saved.password;
      } else {
        setPendingDatabase(database);
        setShowPasswordDialog(true);
        const tempUserValue = process.env.USER || "postgres";
        setTempUser(tempUserValue);
        setPasswordForServer(server);
        setSavePassword(false);
        return;
      }
    }

    finalUser = finalUser || dbUser;
    finalPassword = finalPassword || dbPassword;

    setPendingConnection({ server, database, user: finalUser, password: finalPassword });
    setConnectionNameToSave(database);
    setShowNameDialog(true);
  };

  const handleSaveWithName = () => {
    if (!pendingConnection) return;

    const config: ConnectionConfig = {
      id: `conn-${Date.now()}`,
      name: connectionNameToSave.trim() || pendingConnection.database,
      provider: DatabaseProvider.POSTGRESQL,
      host: pendingConnection.server.host,
      port: pendingConnection.server.port,
      database: pendingConnection.database,
      user: pendingConnection.user,
      password: pendingConnection.password,
    };

    onServerSelect(config);
    setShowNameDialog(false);
    setPendingConnection(null);
    setConnectionNameToSave("");
  };

  const handleCreateDatabase = async () => {
    if (!selectedServer || !newDbName.trim()) {
      toast.error("Please select a server and enter a database name");
      return;
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newDbName)) {
      toast.error("Invalid database name");
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
      if (!response.ok) throw new Error(data.error || "Failed to create database");

      toast.success(`Database "${newDbName}" created successfully`);

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
      toast.error(error instanceof Error ? error.message : "Failed to create database");
    } finally {
      setIsCreating(false);
    }
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
          className={cn(isDetecting && "text-muted-foreground opacity-50")}
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

      <ServerList
        servers={servers}
        onServerExpand={handleExpand}
        onServerConnect={(server) => handleConnectToDatabase(server, "postgres")}
        onDatabaseConnect={handleConnectToDatabase}
        onPasswordRequired={(server) => {
          setPasswordForServer(server);
          setShowPasswordDialog(true);
        }}
        isDetecting={isDetecting}
      />

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Username</Label>
              <Input
                value={tempUser}
                onChange={(e) => setTempUser(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="save"
                checked={savePassword}
                onCheckedChange={(checked) => setSavePassword(!!checked)}
              />
              <label htmlFor="save" className="text-sm">
                Save password
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordSubmit}>Connect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name your connection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Connection Name</Label>
              <Input
                value={connectionNameToSave}
                onChange={(e) => setConnectionNameToSave(e.target.value)}
                placeholder="My Database"
                autoFocus
              />
            </div>
            {pendingConnection && (
              <p className="text-sm text-muted-foreground">
                Connecting to: {pendingConnection.database}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowNameDialog(false);
              setPendingConnection(null);
              setConnectionNameToSave("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveWithName}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}