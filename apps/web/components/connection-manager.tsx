"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Persistence } from "@/lib/persistence";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Database, Check, MoreVertical, Edit, Trash2, AlertTriangle, ChevronRight, ChevronLeft, Server } from "lucide-react";
import type { ConnectionConfig } from "@/lib/db/types";
import { DatabaseProviderSelector } from "@/components/database-provider-selector";
import { DatabaseProvider, getProviderMetadata } from "@/lib/db/providers";
import { parseConnectionURL } from "@/lib/connections/url-parser";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  saveConnection,
  loadConnections,
  deleteConnection,
} from "@/lib/connections/store";
import { cn } from "@/lib/utils";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LocalPostgresManager } from "@/components/local-postgres-manager";

interface ConnectionManagerProps {
  onConnectionSelect: (config: ConnectionConfig) => void;
  currentConnectionId?: string;
  defaultOpen?: boolean;
  onDialogChange?: (open: boolean) => void;
}

export function ConnectionManager({
  onConnectionSelect,
  currentConnectionId,
  defaultOpen = false,
  onDialogChange,
}: ConnectionManagerProps) {
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(defaultOpen);
  
  // Sync external dialog state
  useEffect(() => {
    if (defaultOpen !== isDialogOpen) {
      setIsDialogOpen(defaultOpen);
    }
  }, [defaultOpen]);
  
  const [isTesting, setIsTesting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);
  const [formData, setFormData] = useState<Partial<ConnectionConfig>>({
    name: "",
    provider: DatabaseProvider.POSTGRESQL,
    host: "localhost",
    port: 5432,
    database: "",
    user: "",
    password: "",
    connectionString: "",
  });
  const [connectionMode, setConnectionMode] = useState<"fields" | "url">("fields");
  const [urlParseError, setUrlParseError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [urlDatabaseName, setUrlDatabaseName] = useState<string>("");
  const [urlPassword, setUrlPassword] = useState<string>("");
  const [showLocalPostgresManager, setShowLocalPostgresManager] = useState(false);

  // Helper function to update password in URL
  const updateUrlWithPassword = (url: string, password: string): string => {
    if (!url.trim()) return url;
    
    const protocolMatch = url.match(/^([^:]+):\/\//);
    if (!protocolMatch) return url;
    
    const protocol = protocolMatch[1];
    const afterProtocol = url.substring(protocolMatch[0].length);
    
    // Find the @ symbol (separates credentials from host)
    const atIndex = afterProtocol.lastIndexOf('@');
    if (atIndex === -1) return url;
    
    const credentials = afterProtocol.substring(0, atIndex);
    const hostAndAfter = afterProtocol.substring(atIndex + 1);
    
    // Extract user from credentials (everything before first :)
    const colonIndex = credentials.indexOf(':');
    let user = "";
    if (colonIndex !== -1) {
      user = credentials.substring(0, colonIndex);
    } else {
      user = credentials;
    }
    
    // Build new credentials with updated password
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = password ? encodeURIComponent(password) : "";
    const newCredentials = encodedPassword ? `${encodedUser}:${encodedPassword}` : encodedUser;
    
    return `${protocol}://${newCredentials}@${hostAndAfter}`;
  };

  // Helper function to insert/update database name in URL
  const updateUrlWithDatabase = (url: string, dbName: string): string => {
    if (!url.trim()) return url;
    
    // Find where to insert the database name
    // Look for the pattern: protocol://user:pass@host:port/... or protocol://user:pass@host/...
    const protocolMatch = url.match(/^([^:]+):\/\//);
    if (!protocolMatch) return url;
    
    const protocol = protocolMatch[1];
    const afterProtocol = url.substring(protocolMatch[0].length);
    
    // Find the @ symbol (separates credentials from host)
    const atIndex = afterProtocol.lastIndexOf('@');
    if (atIndex === -1) return url;
    
    const credentials = afterProtocol.substring(0, atIndex);
    const hostAndAfter = afterProtocol.substring(atIndex + 1);
    
    // Find the first / or ? (marks where database should be)
    const slashIndex = hostAndAfter.indexOf('/');
    const queryIndex = hostAndAfter.indexOf('?');
    
    let hostPart: string;
    let queryPart: string;
    
    if (slashIndex !== -1) {
      // There's already a / - replace what's after it (before ?)
      hostPart = hostAndAfter.substring(0, slashIndex);
      const afterSlash = hostAndAfter.substring(slashIndex + 1);
      const dbQueryIndex = afterSlash.indexOf('?');
      queryPart = dbQueryIndex !== -1 ? afterSlash.substring(dbQueryIndex) : '';
    } else if (queryIndex !== -1) {
      // No / but there's a ? - insert / before ?
      hostPart = hostAndAfter.substring(0, queryIndex);
      queryPart = hostAndAfter.substring(queryIndex);
    } else {
      // No / and no ? - just append
      hostPart = hostAndAfter;
      queryPart = '';
    }
    
    // Build the new URL
    if (dbName.trim()) {
      return `${protocol}://${credentials}@${hostPart}/${dbName}${queryPart}`;
    } else {
      // If dbName is empty, remove it but keep the structure
      if (slashIndex !== -1) {
        return `${protocol}://${credentials}@${hostPart}${queryPart}`;
      }
      return url;
    }
  };

  useEffect(() => {
    const conns = loadConnections();
    setConnections(conns);
    
    // If no current connection is set, use the persisted active connection
    if (!currentConnectionId) {
      const activeId = Persistence.getActiveConnectionId();
      if (activeId && conns.find((c) => c.id === activeId)) {
        // Don't auto-select, just show it as active
      }
    }
  }, [currentConnectionId]);

  // Load form draft on mount
  useEffect(() => {
    const draft = Persistence.getConnectionFormDraft();
    if (draft && !editingConnection) {
      setFormData(draft);
      if (draft.connectionString) {
        setConnectionMode("url");
      }
      if (draft.provider) {
        const providerMeta = getProviderMetadata(draft.provider);
        if (providerMeta.connectionType === "url") {
          setConnectionMode("url");
        }
      }
    }
  }, []);

  // Save form draft whenever formData changes (debounced)
  useEffect(() => {
    if (!isDialogOpen || editingConnection) return;
    
    const timeoutId = setTimeout(() => {
      Persistence.setConnectionFormDraft(formData);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData, isDialogOpen, editingConnection]);

  // Sync database name and password from connection string URL
  useEffect(() => {
    if (formData.connectionString) {
      try {
        const parsed = parseConnectionURL(formData.connectionString);
        if (parsed.database !== urlDatabaseName) {
          setUrlDatabaseName(parsed.database || "");
        }
        if (parsed.password !== urlPassword) {
          setUrlPassword(parsed.password || "");
        }
      } catch {
        // Ignore parse errors
      }
    } else {
      if (urlDatabaseName) setUrlDatabaseName("");
      if (urlPassword) setUrlPassword("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.connectionString]);

  const handleTest = async () => {
    // Validate based on connection mode
    if (connectionMode === "url") {
      if (!formData.connectionString) {
        toast.error("Validation error", {
          description: "Please provide a connection URL",
        });
        return;
      }
      try {
        parseConnectionURL(formData.connectionString);
      } catch (error) {
        toast.error("Validation error", {
          description: error instanceof Error ? error.message : "Invalid connection URL",
        });
        return;
      }
    } else {
      if (!formData.host || !formData.database || !formData.user) {
        toast.error("Validation error", {
          description: "Please fill in all required fields",
        });
        return;
      }
    }

    setIsTesting(true);
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error("Connection failed", {
          description: error.error,
        });
        return;
      }

      toast.success("Connection successful!");
    } catch (error) {
      toast.error("Connection failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.provider) {
      toast.error("Validation error", {
        description: "Please fill in all required fields",
      });
      return;
    }

    // Validate provider-specific fields
    const provider = formData.provider;
    const providerMeta = getProviderMetadata(provider);
    
    // Validate based on provider connection type
    if (providerMeta.connectionType === "url") {
      // URL-only providers (Supabase, LibSQL, PlanetScale)
      if (!formData.connectionString) {
        toast.error("Validation error", {
          description: "Please provide a connection URL",
        });
        return;
      }
      try {
        parseConnectionURL(formData.connectionString);
      } catch (error) {
        toast.error("Validation error", {
          description: error instanceof Error ? error.message : "Invalid connection URL",
        });
        return;
      }
    } else if (providerMeta.connectionType === "file") {
      // File-based (SQLite)
      if (!formData.filePath) {
        toast.error("Validation error", {
          description: "Please provide a file path for SQLite",
        });
        return;
      }
    } else if (providerMeta.connectionType === "fields-or-url") {
      // Fields or URL (PostgreSQL, MySQL, MongoDB)
      if (connectionMode === "url") {
        if (!formData.connectionString) {
          toast.error("Validation error", {
            description: "Please provide a connection URL",
          });
          return;
        }
        try {
          parseConnectionURL(formData.connectionString);
        } catch (error) {
          toast.error("Validation error", {
            description: error instanceof Error ? error.message : "Invalid connection URL",
          });
          return;
        }
      } else {
        // Fields mode
        if (!formData.host || !formData.database || !formData.user) {
          toast.error("Validation error", {
            description: "Please fill in all required fields (host, database, user)",
          });
          return;
        }
      }
    }

    const config: ConnectionConfig = {
      id: formData.id || `conn-${Date.now()}`,
      name: formData.name,
      provider: provider,
      host: formData.host,
      port: formData.port || providerMeta.defaultPort,
      database: formData.database,
      user: formData.user,
      password: formData.password || "",
      filePath: formData.filePath,
      connectionString: formData.connectionString,
    };

    saveConnection(config);
    setConnections(loadConnections());
    setIsDialogOpen(false);
    const wasEditing = !!editingConnection;
    setEditingConnection(null);
    setStep(1);
    // Clear draft when connection is saved
    Persistence.clearConnectionFormDraft();
    setFormData({
      name: "",
      provider: DatabaseProvider.POSTGRESQL,
      host: "localhost",
      port: 5432,
      database: "",
      user: "",
      password: "",
      connectionString: "",
    });
    
    if (wasEditing) {
      toast.success("Connection updated", {
        description: `Updated connection "${config.name}"`,
      });
    } else {
      toast.success("Connection saved", {
        description: `Saved connection "${config.name}"`,
      });
      // Automatically connect and navigate to the new connection
      onConnectionSelect(config);
    }
  };

  const handleEdit = (conn: ConnectionConfig) => {
    setEditingConnection(conn);
    setStep(2); // Go directly to step 2 for editing
    const providerMeta = getProviderMetadata(conn.provider);
    const hasConnectionString = !!conn.connectionString;
    setConnectionMode(
      providerMeta.connectionType === "url" 
        ? "url" 
        : providerMeta.connectionType === "file"
        ? "fields"
        : hasConnectionString ? "url" : "fields"
    );
    
    // Extract database name and password from connection string if present
    let dbNameFromUrl = "";
    let passwordFromUrl = "";
    if (conn.connectionString) {
      try {
        const parsed = parseConnectionURL(conn.connectionString);
        dbNameFromUrl = parsed.database || "";
        passwordFromUrl = parsed.password || "";
      } catch {
        // Ignore parse errors
      }
    }
    setUrlDatabaseName(dbNameFromUrl);
    setUrlPassword(passwordFromUrl);
    
    setFormData({
      id: conn.id,
      name: conn.name,
      provider: conn.provider,
      host: conn.host,
      port: conn.port,
      database: conn.database,
      user: conn.user,
      password: conn.password,
      filePath: conn.filePath,
      connectionString: conn.connectionString,
    });
    setIsDialogOpen(true);
  };

  const handleNewConnection = () => {
    setEditingConnection(null);
    setStep(1);
    setConnectionMode("fields");
    setUrlParseError(null);
    setFormData({
      name: "",
      provider: DatabaseProvider.POSTGRESQL,
      host: "localhost",
      port: 5432,
      database: "",
      user: "",
      password: "",
      connectionString: "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnectionToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (connectionToDelete) {
      // Clear active connection if it's the one being deleted
      const activeConnectionId = Persistence.getActiveConnectionId();
      if (activeConnectionId === connectionToDelete) {
        Persistence.setActiveConnectionId(null);
      }
      
      deleteConnection(connectionToDelete);
      const updatedConnections = loadConnections();
      setConnections(updatedConnections);
      toast.success("Connection deleted");
      setConnectionToDelete(null);
      setDeleteConfirmOpen(false);
      
      // If no connections left, ensure active connection is cleared
      if (updatedConnections.length === 0) {
        Persistence.setActiveConnectionId(null);
      }
      
      // Notify parent component to refresh (if onDialogChange is provided)
      if (onDialogChange) {
        onDialogChange(false);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Connections
        </span>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          onDialogChange?.(open);
          if (!open) {
            setEditingConnection(null);
            setStep(1);
            setConnectionMode("fields");
            setUrlParseError(null);
            setUrlDatabaseName("");
            setUrlPassword("");
            // Refresh connections when dialog closes
            setConnections(loadConnections());
            setFormData({
              name: "",
              provider: DatabaseProvider.POSTGRESQL,
              host: "localhost",
              port: 5432,
              database: "",
              user: "",
              password: "",
              connectionString: "",
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNewConnection}>
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingConnection 
                  ? "Edit Connection" 
                  : step === 1 
                    ? "Select Database Provider" 
                    : "Configure Connection"}
              </DialogTitle>
              <DialogDescription>
                {editingConnection 
                  ? "Update your database connection" 
                  : step === 1
                    ? "Choose your database provider"
                    : `Configure your ${getProviderMetadata(formData.provider!).name} connection`}
              </DialogDescription>
            </DialogHeader>
            
            {step === 1 ? (
              showLocalPostgresManager && formData.provider === DatabaseProvider.POSTGRESQL ? (
                <div className="py-4 max-h-[70vh] overflow-y-auto">
                  <LocalPostgresManager
                    onServerSelect={(config) => {
                      // Save and connect
                      saveConnection(config);
                      setConnections(loadConnections());
                      onConnectionSelect(config);
                      setIsDialogOpen(false);
                      if (onDialogChange) onDialogChange(false);
                      toast.success("Connected to local PostgreSQL server");
                    }}
                    onCreateDatabase={(config) => {
                      // Save and connect
                      saveConnection(config);
                      setConnections(loadConnections());
                      onConnectionSelect(config);
                      setIsDialogOpen(false);
                      if (onDialogChange) onDialogChange(false);
                    }}
                  />
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLocalPostgresManager(false)}
                      className="w-full"
                    >
                      Back to manual connection
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Connection Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="My Database"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="provider">Database Provider</Label>
                    <DatabaseProviderSelector
                      value={formData.provider}
                      onValueChange={(provider) => {
                        const meta = getProviderMetadata(provider);
                        setFormData({
                          ...formData,
                          provider,
                          port: meta.defaultPort || formData.port,
                        });
                        // Auto-set connection mode based on provider
                        if (meta.connectionType === "url") {
                          setConnectionMode("url");
                        } else if (meta.connectionType === "file") {
                          setConnectionMode("fields");
                        } else {
                          setConnectionMode("fields");
                        }
                      }}
                    />
                  </div>
                  {formData.provider === DatabaseProvider.POSTGRESQL && (
                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowLocalPostgresManager(true)}
                      >
                        <Server className="mr-2 h-4 w-4" />
                        Use Local PostgreSQL Manager
                      </Button>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="grid gap-4 py-4">
                {(() => {
                  const providerMeta = getProviderMetadata(formData.provider!);
                  
                  // URL-only providers (Supabase, LibSQL, PlanetScale)
                  if (providerMeta.connectionType === "url") {
                    return (
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label htmlFor="connectionString">Connection URL</Label>
                          <Input
                            id="connectionString"
                            value={formData.connectionString || ""}
                            onChange={(e) => {
                              const url = e.target.value;
                              setFormData({ ...formData, connectionString: url });
                              setUrlParseError(null);
                              
                              if (url.trim()) {
                                try {
                                  const parsed = parseConnectionURL(url);
                                  setFormData({
                                    ...formData,
                                    connectionString: url,
                                    host: parsed.host,
                                    port: parsed.port,
                                    database: parsed.database,
                                    user: parsed.user,
                                    password: parsed.password,
                                  });
                                  // Sync urlDatabaseName and urlPassword with parsed values
                                  setUrlDatabaseName(parsed.database || "");
                                  setUrlPassword(parsed.password || "");
                                } catch (error) {
                                  setUrlParseError(error instanceof Error ? error.message : "Invalid URL format");
                                }
                              } else {
                                setUrlDatabaseName("");
                                setUrlPassword("");
                              }
                            }}
                            placeholder={providerMeta.urlPlaceholder || "postgresql://user:password@host:port/database"}
                          />
                          {urlParseError && (
                            <p className="text-sm text-destructive">{urlParseError}</p>
                          )}
                        </div>
                        
                        {/* Password input - always visible */}
                        {formData.connectionString && (() => {
                          try {
                            parseConnectionURL(formData.connectionString);
                            return (
                              <div className="grid gap-2">
                                <Label htmlFor="urlPassword">Password</Label>
                                <Input
                                  id="urlPassword"
                                  type="password"
                                  value={urlPassword}
                                  onChange={(e) => {
                                    const password = e.target.value;
                                    setUrlPassword(password);
                                    // Update the connection string in real-time
                                    const updatedUrl = updateUrlWithPassword(formData.connectionString || "", password);
                                    setFormData({ ...formData, connectionString: updatedUrl });
                                    
                                    // Also update parsed fields
                                    try {
                                      const parsed = parseConnectionURL(updatedUrl);
                                      setFormData({
                                        ...formData,
                                        connectionString: updatedUrl,
                                        host: parsed.host,
                                        port: parsed.port,
                                        database: parsed.database,
                                        user: parsed.user,
                                        password: parsed.password,
                                      });
                                    } catch {
                                      // Ignore parse errors
                                    }
                                  }}
                                  placeholder="Enter password"
                                />
                              </div>
                            );
                          } catch {
                            return null;
                          }
                        })()}
                        
                        {/* Database name input - always visible */}
                        {formData.connectionString && (() => {
                          try {
                            parseConnectionURL(formData.connectionString);
                            return (
                              <div className="grid gap-2">
                                <Label htmlFor="urlDatabaseName">Database Name</Label>
                                <Input
                                  id="urlDatabaseName"
                                  value={urlDatabaseName}
                                  onChange={(e) => {
                                    const dbName = e.target.value;
                                    setUrlDatabaseName(dbName);
                                    // Update the connection string in real-time
                                    const updatedUrl = updateUrlWithDatabase(formData.connectionString || "", dbName);
                                    setFormData({ ...formData, connectionString: updatedUrl });
                                    
                                    // Also update parsed fields
                                    try {
                                      const parsed = parseConnectionURL(updatedUrl);
                                      setFormData({
                                        ...formData,
                                        connectionString: updatedUrl,
                                        host: parsed.host,
                                        port: parsed.port,
                                        database: parsed.database,
                                        user: parsed.user,
                                        password: parsed.password,
                                      });
                                    } catch {
                                      // Ignore parse errors
                                    }
                                  }}
                                  placeholder="Enter database name"
                                />
                              </div>
                            );
                          } catch {
                            return null;
                          }
                        })()}
                        
                        {/* Supabase IPv4 Warning */}
                        {providerMeta.id === DatabaseProvider.SUPABASE && formData.connectionString && (() => {
                          try {
                            const parsed = parseConnectionURL(formData.connectionString);
                            if (!parsed.isSessionPooler) {
                              return (
                                <Alert variant="warning">
                                  <AlertTriangle className="h-4 w-4" />
                                  <AlertDescription>
                                    <strong>IPv4 Compatibility Notice</strong>
                                    <br />
                                    Supabase direct connections require IPv6 support. If you're on an IPv4 network:
                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                      <li>Use the Session Pooler connection string instead (port 6543)</li>
                                      <li>Or purchase the IPv4 add-on from Supabase</li>
                                    </ul>
                                  </AlertDescription>
                                </Alert>
                              );
                            }
                          } catch {
                            // Ignore parse errors
                          }
                          return null;
                        })()}
                      </div>
                    );
                  }
                  
                  // File-based (SQLite)
                  if (providerMeta.connectionType === "file") {
                    return (
                      <div className="grid gap-2">
                        <Label htmlFor="filePath">Database File Path</Label>
                        <Input
                          id="filePath"
                          value={formData.filePath || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, filePath: e.target.value })
                          }
                          placeholder="/path/to/database.db"
                        />
                      </div>
                    );
                  }
                  
                  // Fields or URL (PostgreSQL, MySQL, MongoDB)
                  if (providerMeta.connectionType === "fields-or-url") {
                    return (
                      <Tabs value={connectionMode} onValueChange={(v) => setConnectionMode(v as "fields" | "url")}>
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="fields">Connection Fields</TabsTrigger>
                          <TabsTrigger value="url">Connection URL</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="url" className="space-y-4 mt-4">
                          <div className="grid gap-2">
                            <Label htmlFor="connectionString">Connection URL</Label>
                            <Input
                              id="connectionString"
                              value={formData.connectionString || ""}
                              onChange={(e) => {
                                const url = e.target.value;
                                setFormData({ ...formData, connectionString: url });
                                setUrlParseError(null);
                                
                                if (url.trim()) {
                                  try {
                                    const parsed = parseConnectionURL(url);
                                    setFormData({
                                      ...formData,
                                      connectionString: url,
                                      host: parsed.host,
                                      port: parsed.port,
                                      database: parsed.database,
                                      user: parsed.user,
                                      password: parsed.password,
                                    });
                                    // Sync urlDatabaseName and urlPassword with parsed values
                                    setUrlDatabaseName(parsed.database || "");
                                    setUrlPassword(parsed.password || "");
                                  } catch (error) {
                                    setUrlParseError(error instanceof Error ? error.message : "Invalid URL format");
                                  }
                                } else {
                                  setUrlDatabaseName("");
                                  setUrlPassword("");
                                }
                              }}
                              placeholder={providerMeta.urlPlaceholder || "postgresql://user:password@host:port/database"}
                            />
                            {urlParseError && (
                              <p className="text-sm text-destructive">{urlParseError}</p>
                            )}
                          </div>
                          
                          {/* Password input - always visible when URL is present */}
                          {formData.connectionString && (() => {
                            try {
                              parseConnectionURL(formData.connectionString);
                              return (
                                <div className="grid gap-2">
                                  <Label htmlFor="urlPassword">Password</Label>
                                  <Input
                                    id="urlPassword"
                                    type="password"
                                    value={urlPassword}
                                    onChange={(e) => {
                                      const password = e.target.value;
                                      setUrlPassword(password);
                                      // Update the connection string in real-time
                                      const updatedUrl = updateUrlWithPassword(formData.connectionString || "", password);
                                      setFormData({ ...formData, connectionString: updatedUrl });
                                      
                                      // Also update parsed fields
                                      try {
                                        const parsed = parseConnectionURL(updatedUrl);
                                        setFormData({
                                          ...formData,
                                          connectionString: updatedUrl,
                                          host: parsed.host,
                                          port: parsed.port,
                                          database: parsed.database,
                                          user: parsed.user,
                                          password: parsed.password,
                                        });
                                      } catch {
                                        // Ignore parse errors
                                      }
                                    }}
                                    placeholder="Enter password"
                                  />
                                </div>
                              );
                            } catch {
                              return null;
                            }
                          })()}
                          
                          {/* Database name input - always visible when URL is present */}
                          {formData.connectionString && (() => {
                            try {
                              parseConnectionURL(formData.connectionString);
                              return (
                                <div className="grid gap-2">
                                  <Label htmlFor="urlDatabaseName">Database Name</Label>
                                  <Input
                                    id="urlDatabaseName"
                                    value={urlDatabaseName}
                                    onChange={(e) => {
                                      const dbName = e.target.value;
                                      setUrlDatabaseName(dbName);
                                      // Update the connection string in real-time
                                      const updatedUrl = updateUrlWithDatabase(formData.connectionString || "", dbName);
                                      setFormData({ ...formData, connectionString: updatedUrl });
                                      
                                      // Also update parsed fields
                                      try {
                                        const parsed = parseConnectionURL(updatedUrl);
                                        setFormData({
                                          ...formData,
                                          connectionString: updatedUrl,
                                          host: parsed.host,
                                          port: parsed.port,
                                          database: parsed.database,
                                          user: parsed.user,
                                          password: parsed.password,
                                        });
                                      } catch {
                                        // Ignore parse errors
                                      }
                                    }}
                                    placeholder="Enter database name"
                                  />
                                </div>
                              );
                            } catch {
                              return null;
                            }
                          })()}
                        </TabsContent>
                        
                        <TabsContent value="fields" className="space-y-4 mt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label htmlFor="host">Host</Label>
                              <Input
                                id="host"
                                value={formData.host || ""}
                                onChange={(e) =>
                                  setFormData({ ...formData, host: e.target.value })
                                }
                                placeholder="localhost"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="port">Port</Label>
                              <Input
                                id="port"
                                type="number"
                                value={formData.port || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    port: parseInt(e.target.value) || providerMeta.defaultPort,
                                  })
                                }
                                placeholder={providerMeta.defaultPort.toString()}
                              />
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="database">Database</Label>
                            <Input
                              id="database"
                              value={formData.database || ""}
                              onChange={(e) =>
                                setFormData({ ...formData, database: e.target.value })
                              }
                              placeholder="database_name"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="user">User</Label>
                            <Input
                              id="user"
                              value={formData.user || ""}
                              onChange={(e) =>
                                setFormData({ ...formData, user: e.target.value })
                              }
                              placeholder="username"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                              id="password"
                              type="password"
                              value={formData.password || ""}
                              onChange={(e) =>
                                setFormData({ ...formData, password: e.target.value })
                              }
                              placeholder="••••••••"
                            />
                          </div>
                        </TabsContent>
                      </Tabs>
                    );
                  }
                  
                  return null;
                })()}
              </div>
            )}
            
            <DialogFooter>
              {step === 1 ? (
                !showLocalPostgresManager ? (
                  <Button
                    onClick={() => {
                      if (!formData.name || !formData.provider) {
                        toast.error("Validation error", {
                          description: "Please provide a name and select a provider",
                        });
                        return;
                      }
                      setStep(2);
                    }}
                    className="w-full"
                  >
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : null
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={isTesting}
                  >
                    {isTesting ? "Testing..." : "Test"}
                  </Button>
                  <Button onClick={handleSave}>{editingConnection ? "Update" : "Save"}</Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-1">
        {connections.map((conn) => (
          <div
            key={conn.id}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors group",
              "hover:bg-accent/50",
              currentConnectionId === conn.id
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            <button
              onClick={() => onConnectionSelect(conn)}
              className="flex-1 flex items-center gap-2 text-left min-w-0"
            >
              <Database className="h-4 w-4 shrink-0" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-32 text-wrap line-clamp-1">{conn.name}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{conn.name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {currentConnectionId === conn.id && (
                <Check className="h-4 w-4 shrink-0" />
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded hover:bg-accent transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => handleEdit(conn)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setConnectionToDelete(conn.id);
                    setDeleteConfirmOpen(true);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {connections.length === 0 && (
          <p className="px-2 text-xs text-muted-foreground">
            No connections. Click + to add one.
          </p>
        )}
      </div>
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Connection"
        description="Are you sure you want to delete this connection? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
