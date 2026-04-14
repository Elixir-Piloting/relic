"use client";

import { useState, useEffect } from "react";
import { Plus, ChevronRight, ChevronLeft, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { ConnectionConfig } from "@/lib/db/types";
import { DatabaseProvider, getProviderMetadata } from "@/lib/db/providers";
import { parseConnectionURL } from "@/lib/connections/url-parser";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatabaseProviderSelector } from "@/components/database-provider-selector";
import { LocalPostgresManager } from "@/components/local-postgres-manager";
import { saveConnection, loadConnections } from "@/lib/connections/store";
import { cn } from "@/lib/utils";

interface ConnectionFormProps {
  isOpen: boolean;
  defaultOpen?: boolean;
  editingConnection?: ConnectionConfig | null;
  onDialogChange?: (open: boolean) => void;
  onConnectionSelect: (config: ConnectionConfig) => void;
}

const DEFAULT_FORM_DATA: Partial<ConnectionConfig> = {
  name: "",
  provider: DatabaseProvider.POSTGRESQL,
  host: "localhost",
  port: 5432,
  database: "",
  user: "",
  password: "",
  connectionString: "",
};

export function ConnectionForm({
  isOpen,
  editingConnection,
  onDialogChange,
  onConnectionSelect,
}: ConnectionFormProps) {
  const [formData, setFormData] = useState<Partial<ConnectionConfig>>(DEFAULT_FORM_DATA);
  const [connectionMode, setConnectionMode] = useState<"fields" | "url">("fields");
  const [urlParseError, setUrlParseError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [urlDatabaseName, setUrlDatabaseName] = useState<string>("");
  const [urlPassword, setUrlPassword] = useState<string>("");
  const [showLocalPostgresManager, setShowLocalPostgresManager] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionString, setConnectionString] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(isOpen);

  useEffect(() => {
    setIsDialogOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (editingConnection) {
      setStep(2);
      const providerMeta = getProviderMetadata(editingConnection.provider);
      const hasConnectionString = !!editingConnection.connectionString;
      setConnectionMode(
        providerMeta.connectionType === "url"
          ? "url"
          : providerMeta.connectionType === "file"
          ? "fields"
          : hasConnectionString
          ? "url"
          : "fields"
      );

      let dbNameFromUrl = "";
      let passwordFromUrl = "";
      if (editingConnection.connectionString) {
        try {
          const parsed = parseConnectionURL(editingConnection.connectionString);
          dbNameFromUrl = parsed.database || "";
          passwordFromUrl = parsed.password || "";
        } catch {}
      }
      setUrlDatabaseName(dbNameFromUrl);
      setUrlPassword(passwordFromUrl);

      setFormData({
        id: editingConnection.id,
        name: editingConnection.name,
        provider: editingConnection.provider,
        host: editingConnection.host,
        port: editingConnection.port,
        database: editingConnection.database,
        user: editingConnection.user,
        password: editingConnection.password,
        filePath: editingConnection.filePath,
        connectionString: editingConnection.connectionString,
      });
    } else {
      setStep(1);
      setConnectionMode("fields");
    }
  }, [editingConnection]);

  const updateUrlWithPassword = (url: string, password: string): string => {
    if (!url.trim()) return url;

    const protocolMatch = url.match(/^([^:]+):\/\//);
    if (!protocolMatch) return url;

    const protocol = protocolMatch[1];
    const afterProtocol = url.substring(protocolMatch[0].length);
    const atIndex = afterProtocol.lastIndexOf("@");
    if (atIndex === -1) return url;

    const credentials = afterProtocol.substring(0, atIndex);
    const hostAndAfter = afterProtocol.substring(atIndex + 1);
    const colonIndex = credentials.indexOf(":");
    let user = "";
    if (colonIndex !== -1) {
      user = credentials.substring(0, colonIndex);
    } else {
      user = credentials;
    }

    const encodedUser = encodeURIComponent(user);
    const encodedPassword = password ? encodeURIComponent(password) : "";
    const newCredentials = encodedPassword ? `${encodedUser}:${encodedPassword}` : encodedUser;

    return `${protocol}://${newCredentials}@${hostAndAfter}`;
  };

  const updateUrlWithDatabase = (url: string, dbName: string): string => {
    if (!url.trim()) return url;

    const protocolMatch = url.match(/^([^:]+):\/\//);
    if (!protocolMatch) return url;

    const protocol = protocolMatch[1];
    const afterProtocol = url.substring(protocolMatch[0].length);
    const atIndex = afterProtocol.lastIndexOf("@");
    if (atIndex === -1) return url;

    const credentials = afterProtocol.substring(0, atIndex);
    const hostAndAfter = afterProtocol.substring(atIndex + 1);
    const slashIndex = hostAndAfter.indexOf("/");
    const queryIndex = hostAndAfter.indexOf("?");

    let hostPart: string;
    let queryPart: string;

    if (slashIndex !== -1) {
      hostPart = hostAndAfter.substring(0, slashIndex);
      const afterSlash = hostAndAfter.substring(slashIndex + 1);
      const dbQueryIndex = afterSlash.indexOf("?");
      queryPart = dbQueryIndex !== -1 ? afterSlash.substring(dbQueryIndex) : "";
    } else if (queryIndex !== -1) {
      hostPart = hostAndAfter.substring(0, queryIndex);
      queryPart = hostAndAfter.substring(queryIndex);
    } else {
      hostPart = hostAndAfter;
      queryPart = "";
    }

    if (dbName.trim()) {
      return `${protocol}://${credentials}@${hostPart}/${dbName}${queryPart}`;
    } else {
      if (slashIndex !== -1) {
        return `${protocol}://${credentials}@${hostPart}${queryPart}`;
      }
      return url;
    }
  };

  const handleTest = async () => {
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

    const provider = formData.provider;
    const providerMeta = getProviderMetadata(provider);

    if (providerMeta.connectionType === "url") {
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
      if (!formData.filePath) {
        toast.error("Validation error", {
          description: "Please provide a file path for SQLite",
        });
        return;
      }
    } else if (providerMeta.connectionType === "fields-or-url") {
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
    setIsDialogOpen(false);
    const wasEditing = !!editingConnection;
    if (wasEditing) {
      toast.success("Connection updated", {
        description: `Updated connection "${config.name}"`,
      });
    } else {
      toast.success("Connection saved", {
        description: `Saved connection "${config.name}"`,
      });
      onConnectionSelect(config);
    }
    setFormData(DEFAULT_FORM_DATA);
    setStep(1);
  };

  if (!isDialogOpen) return null;

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        setIsDialogOpen(open);
        onDialogChange?.(open);
        if (!open) {
          setStep(1);
          setConnectionMode("fields");
          setUrlParseError(null);
          setUrlDatabaseName("");
          setUrlPassword("");
          setFormData(DEFAULT_FORM_DATA);
        }
      }}
    >
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
                  saveConnection(config);
                  onConnectionSelect(config);
                  setIsDialogOpen(false);
                  onDialogChange?.(false);
                  toast.success("Connected to local PostgreSQL server");
                }}
                onCreateDatabase={(config) => {
                  saveConnection(config);
                  onConnectionSelect(config);
                  setIsDialogOpen(false);
                  onDialogChange?.(false);
                }}
              />
              <div className="mt-4 pt-4 border-t">
                <Button variant="ghost" size="sm" onClick={() => setShowLocalPostgresManager(false)} className="w-full">
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
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                      {urlParseError && <p className="text-sm text-destructive">{urlParseError}</p>}
                    </div>

                    {formData.connectionString && (() => {
                      try {
                        parseConnectionURL(formData.connectionString);
                        return (
                          <>
                            <div className="grid gap-2">
                              <Label htmlFor="urlPassword">Password</Label>
                              <Input
                                id="urlPassword"
                                type="password"
                                value={urlPassword}
                                onChange={(e) => {
                                  const password = e.target.value;
                                  setUrlPassword(password);
                                  const updatedUrl = updateUrlWithPassword(formData.connectionString || "", password);
                                  setFormData({ ...formData, connectionString: updatedUrl });

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
                                  } catch {}
                                }}
                                placeholder="Enter password"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="urlDatabaseName">Database Name</Label>
                              <Input
                                id="urlDatabaseName"
                                value={urlDatabaseName}
                                onChange={(e) => {
                                  const dbName = e.target.value;
                                  setUrlDatabaseName(dbName);
                                  const updatedUrl = updateUrlWithDatabase(formData.connectionString || "", dbName);
                                  setFormData({ ...formData, connectionString: updatedUrl });

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
                                  } catch {}
                                }}
                                placeholder="Enter database name"
                              />
                            </div>
                          </>
                        );
                      } catch {
                        return null;
                      }
                    })()}

                    {providerMeta.id === DatabaseProvider.SUPABASE && formData.connectionString && (() => {
                      try {
                        const parsed = parseConnectionURL(formData.connectionString);
                        if (!parsed.isSessionPooler) {
                          return (
                            <Alert variant="warning">
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
                      } catch {}
                      return null;
                    })()}
                  </div>
                );
              }

              if (providerMeta.connectionType === "file") {
                return (
                  <div className="grid gap-2">
                    <Label htmlFor="filePath">Database File Path</Label>
                    <Input
                      id="filePath"
                      value={formData.filePath || ""}
                      onChange={(e) => setFormData({ ...formData, filePath: e.target.value })}
                      placeholder="/path/to/database.db"
                    />
                  </div>
                );
              }

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
                        {urlParseError && <p className="text-sm text-destructive">{urlParseError}</p>}
                      </div>

                      {formData.connectionString && (() => {
                        try {
                          parseConnectionURL(formData.connectionString);
                          return (
                            <>
                              <div className="grid gap-2">
                                <Label htmlFor="urlPassword">Password</Label>
                                <Input
                                  id="urlPassword"
                                  type="password"
                                  value={urlPassword}
                                  onChange={(e) => {
                                    const password = e.target.value;
                                    setUrlPassword(password);
                                    const updatedUrl = updateUrlWithPassword(formData.connectionString || "", password);
                                    setFormData({ ...formData, connectionString: updatedUrl });

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
                                    } catch {}
                                  }}
                                  placeholder="Enter password"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="urlDatabaseName">Database Name</Label>
                                <Input
                                  id="urlDatabaseName"
                                  value={urlDatabaseName}
                                  onChange={(e) => {
                                    const dbName = e.target.value;
                                    setUrlDatabaseName(dbName);
                                    const updatedUrl = updateUrlWithDatabase(formData.connectionString || "", dbName);
                                    setFormData({ ...formData, connectionString: updatedUrl });

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
                                    } catch {}
                                  }}
                                  placeholder="Enter database name"
                                />
                              </div>
                            </>
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
                            onChange={(e) => setFormData({ ...formData, host: e.target.value })}
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
                          onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                          placeholder="database_name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="user">User</Label>
                        <Input
                          id="user"
                          value={formData.user || ""}
                          onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                          placeholder="username"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password || ""}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={isTesting}>
                {isTesting ? "Testing..." : "Test"}
              </Button>
              <Button onClick={handleSave}>{editingConnection ? "Update" : "Save"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}