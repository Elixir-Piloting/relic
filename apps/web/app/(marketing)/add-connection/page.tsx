"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatabaseProvider, getProviderMetadata } from "@/lib/db/providers";
import { ProviderGrid } from "@/components/provider-grid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Server } from "lucide-react";
import { parseConnectionURL } from "@/lib/connections/url-parser";
import { cn } from "@/lib/utils";

export default function AddConnectionPage() {
  const router = useRouter();
  const [connectionString, setConnectionString] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const handleConnectionStringChange = (url: string) => {
    setConnectionString(url);
    setParseError(null);

    if (!url.trim()) return;

    try {
      const parsed = parseConnectionURL(url);
      const meta = getProviderMetadata(parsed.provider || DatabaseProvider.POSTGRESQL);
      router.push(`/add-connection/${parsed.provider || meta.id}?connectionString=${encodeURIComponent(url)}`);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Invalid connection URL");
    }
  };

  const handleProviderSelect = (provider: DatabaseProvider) => {
    router.push(`/add-connection/${provider}`);
  };

  return (
    <div className="space-y-8 marketing-inputs">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Add Connection</h1>
        <p className="text-muted-foreground">
          Connect to your database by entering a connection string or selecting a provider.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="connectionString">Connection String</Label>
        <Input
          id="connectionString"
          value={connectionString}
          onChange={(e) => handleConnectionStringChange(e.target.value)}
          placeholder="postgresql://user:password@host:port/database"
          className={cn(parseError && "border-destructive")}
        />
        {parseError && (
          <p className="text-sm text-destructive">{parseError}</p>
        )}
      </div>

      <div className="relative flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-sm text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Select a Provider</h2>
        <div className="no-ring">
          <ProviderGrid onSelect={handleProviderSelect} />
        </div>
      </div>

      <div className="relative flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-sm text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <Button
        variant="outline"
        className="w-full justify-start gap-3"
        onClick={() => router.push("/add-connection/local")}
      >
        <Server className="h-4 w-4" />
        Continue with local PostgreSQL
      </Button>
    </div>
  );
}