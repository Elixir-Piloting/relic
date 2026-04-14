"use client";

import { useState, useEffect, Suspense, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DatabaseProvider, getProviderMetadata } from "@/lib/db/providers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { parseConnectionURL } from "@/lib/connections/url-parser";
import type { ConnectionConfig } from "@/lib/db/types";
import { useSaveConnection } from "@/lib/query/hooks/use-connections";
import { Persistence } from "@/lib/persistence";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionFormPageProps {
  params: Promise<{ provider: string }>;
}

const DEFAULT_FORM_DATA = {
  name: "",
  provider: DatabaseProvider.POSTGRESQL,
  host: "localhost",
  port: 5432,
  database: "",
  user: "",
  password: "",
  connectionString: "",
  filePath: "",
  ssl: false,
  ssh: false,
};

function ConnectionFormContent({ provider }: { provider: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const saveConnectionMutation = useSaveConnection();

  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [urlParseError, setUrlParseError] = useState<string | null>(null);

  useEffect(() => {
    const providerEnum = provider as DatabaseProvider;
    const meta = getProviderMetadata(providerEnum);
    
    setFormData((prev) => ({
      ...prev,
      provider: providerEnum,
      port: meta.defaultPort || prev.port,
    }));

    const connectionStringParam = searchParams.get("connectionString");
    if (connectionStringParam) {
      try {
        const parsed = parseConnectionURL(decodeURIComponent(connectionStringParam));
        setFormData({
          ...DEFAULT_FORM_DATA,
          provider: providerEnum,
          connectionString: decodeURIComponent(connectionStringParam),
          host: parsed.host || "",
          port: parsed.port || meta.defaultPort,
          database: parsed.database || "",
          user: parsed.user || "",
          password: parsed.password || "",
        });
      } catch {
        setFormData((prev) => ({
          ...prev,
          provider: providerEnum,
          connectionString: decodeURIComponent(connectionStringParam),
        }));
      }
    }
  }, [provider, searchParams]);

  const meta = getProviderMetadata(formData.provider);

  const updateFormField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleUrlChange = (url: string) => {
    updateFormField("connectionString", url);
    setUrlParseError(null);

    if (!url.trim()) {
      setFormData((prev) => ({
        ...prev,
        connectionString: "",
        host: "",
        port: meta.defaultPort,
        database: "",
        user: "",
        password: "",
      }));
      return;
    }

    try {
      const parsed = parseConnectionURL(url);
      setFormData((prev) => ({
        ...prev,
        connectionString: url,
        host: parsed.host || "",
        port: parsed.port || meta.defaultPort,
        database: parsed.database || "",
        user: parsed.user || "",
        password: parsed.password || "",
      }));
    } catch (error) {
      setUrlParseError(error instanceof Error ? error.message : "Invalid URL format");
    }
  };

  const handleTest = async () => {
    if (meta.connectionType === "file") {
      if (!formData.filePath) {
        toast.error("Please provide a file path");
        return;
      }
    } else if (!formData.connectionString) {
      toast.error("Please provide a connection URL");
      return;
    }

    if (formData.connectionString) {
      try {
        parseConnectionURL(formData.connectionString);
      } catch (error) {
        toast.error("Invalid connection URL", {
          description: error instanceof Error ? error.message : "Unknown error",
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
        throw new Error(error.error || "Connection failed");
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

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Please provide a connection name");
      return;
    }

    if (meta.connectionType === "file") {
      if (!formData.filePath) {
        toast.error("Please provide a file path");
        return;
      }
    } else {
      if (!formData.connectionString) {
        toast.error("Please provide a connection URL");
        return;
      }

      try {
        parseConnectionURL(formData.connectionString);
      } catch (error) {
        toast.error("Invalid connection URL", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const config: ConnectionConfig = {
        id: `conn-${Date.now()}`,
        name: formData.name,
        provider: formData.provider,
        host: formData.host,
        port: formData.port,
        database: formData.database,
        user: formData.user,
        password: formData.password || "",
        connectionString: formData.connectionString,
        filePath: formData.filePath,
        ssl: formData.ssl,
        ssh: formData.ssh,
      };

      await saveConnectionMutation.mutateAsync({ connection: config });
      
      Persistence.setActiveConnectionId(config.id);
      
      toast.success("Connection saved", {
        description: `Saved connection "${config.name}"`,
      });

      router.push(`/db/${config.id}`);
    } catch (error) {
      toast.error("Failed to save connection", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderForm = () => {
    // URL-based providers (LibSQL, Supabase, PlanetScale)
    if (meta.connectionType === "url") {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="connectionString">Connection URI</Label>
            <Input
              id="connectionString"
              value={formData.connectionString}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={meta.urlPlaceholder}
              className={cn(urlParseError && "border-destructive")}
            />
            {urlParseError && (
              <p className="text-sm text-destructive">{urlParseError}</p>
            )}
          </div>
        </div>
      );
    }

    // File-based providers (SQLite)
    if (meta.connectionType === "file") {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="filePath">Database File Path</Label>
            <Input
              id="filePath"
              value={formData.filePath || ""}
              onChange={(e) => updateFormField("filePath", e.target.value)}
              placeholder="/path/to/database.db"
            />
          </div>
        </div>
      );
    }

    // Fields-or-url providers (PostgreSQL, MySQL, MongoDB)
    return (
      <>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="connectionString">Connection URI</Label>
            <Input
              id="connectionString"
              value={formData.connectionString}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={meta.urlPlaceholder}
              className={cn(urlParseError && "border-destructive")}
            />
            {urlParseError && (
              <p className="text-sm text-destructive">{urlParseError}</p>
            )}
          </div>
        </div>

        <div className="relative">
          <Separator />
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-sm text-muted-foreground">
            or
          </span>
        </div>

        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={formData.host}
                onChange={(e) => updateFormField("host", e.target.value)}
                placeholder="localhost"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={formData.port}
                onChange={(e) => updateFormField("port", parseInt(e.target.value) || meta.defaultPort)}
                placeholder={meta.defaultPort.toString()}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="database">
              {meta.id === DatabaseProvider.MONGODB ? "Database Name (optional)" : "Database Name (optional)"}
            </Label>
            <Input
              id="database"
              value={formData.database}
              onChange={(e) => updateFormField("database", e.target.value)}
              placeholder="Leave empty to select database after connecting"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user">Username</Label>
            <Input
              id="user"
              value={formData.user}
              onChange={(e) => updateFormField("user", e.target.value)}
              placeholder={meta.id === DatabaseProvider.MONGODB ? "root" : "postgres"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => updateFormField("password", e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-8 marketing-buttons marketing-inputs">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Add {meta.name} Connection</h1>
      </div>

      <div className="space-y-4">
        <Label htmlFor="name">Connection Label</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => updateFormField("name", e.target.value)}
          placeholder="My Production Database"
        />
        <p className="text-sm text-muted-foreground">
          A friendly name to identify this connection
        </p>
      </div>

      {renderForm()}

      {meta.id !== DatabaseProvider.SQLITE && (
        <>
          <div className="relative">
            <Separator />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-sm text-muted-foreground">
              or
            </span>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="ssl">SSL Mode</Label>
                <p className="text-sm text-muted-foreground">Disabled</p>
              </div>
              <Switch
                id="ssl"
                checked={formData.ssl}
                onCheckedChange={(checked) => updateFormField("ssl", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="ssh">SSH Tunnel</Label>
                <p className="text-sm text-muted-foreground">Off</p>
              </div>
              <Switch
                id="ssh"
                checked={formData.ssh}
                onCheckedChange={(checked) => updateFormField("ssh", checked)}
              />
            </div>
          </div>
        </>
      )}

      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={isTesting}
          className="gap-2"
        >
          {isTesting && <Loader2 className="h-4 w-4 animate-spin" />}
          Test Connection
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="gap-2"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Connection
        </Button>
      </div>
    </div>
  );
}

export default function ConnectionFormPage({ params }: ConnectionFormPageProps) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ConnectionFormContent provider={resolvedParams.provider} />
    </Suspense>
  );
}