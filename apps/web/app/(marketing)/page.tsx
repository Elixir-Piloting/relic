"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConnections } from "@/lib/query/hooks/use-connections";
import type { ConnectionConfig } from "@/lib/db/types";
import { Persistence } from "@/lib/persistence";
import { getProviderMetadata } from "@/lib/db/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLogo } from "@/components/app-logo";
import { Database, Plus, Search, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  const meta = getProviderMetadata(provider as any);
  
  return (
    <div 
      className={cn("relative w-5 h-5 shrink-0 rounded-sm flex items-center justify-center", className)}
      style={{
        backgroundColor: meta?.color + "20",
      }}
    >
      {meta?.iconType === "image" ? (
        <img
          src={meta?.icon}
          alt={meta?.name}
          className="w-full h-full object-contain p-0.5"
          onError={(e) => {
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.innerHTML = `<span class="text-[8px] font-bold" style="color: ${meta?.color === '#FFFFFF' || meta?.color === '#000000' ? '#1d1d1f' : meta?.color}">${meta?.name?.charAt(0) || '?'}</span>`;
            }
          }}
        />
      ) : (
        <span className="text-xs font-bold" style={{ color: meta?.color }}>{meta?.name?.charAt(0)}</span>
      )}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { data: connections = [], isLoading } = useConnections();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConnections = connections.filter((conn) =>
    conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conn.host?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conn.database?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConnectionSelect = (config: ConnectionConfig) => {
    Persistence.setActiveConnectionId(config.id);
    const lastView = Persistence.getActiveView(config.id) || "tables";
    router.push(`/db/${config.id}${lastView === "query" ? "/query" : lastView === "visualizer" ? "/visualizer" : ""}`);
  };

  const handleAddConnection = () => {
    router.push("/add-connection");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-muted/20">
        <div className="flex items-center gap-2">
          <AppLogo className="h-5 w-5" />
          <span className="font-medium">Relic</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-6">
          <div className="space-y-8 pt-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold">Connections</h1>
              <p className="text-muted-foreground">
                Manage your database connections
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search connections..."
                  className="pl-9"
                />
              </div>
              <Button onClick={handleAddConnection} className="gap-2 shrink-0">
                <Plus className="h-4 w-4" />
                Add Connection
              </Button>
            </div>

            {filteredConnections.length === 0 ? (
              <div className="text-center py-12">
                <Database className="h-12 w-12 mx-auto opacity-50 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {searchQuery ? "No connections found" : "No connections yet"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery 
                    ? "Try a different search term"
                    : "Create your first database connection to get started."
                  }
                </p>
                {!searchQuery && (
                  <Button onClick={handleAddConnection}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Connection
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredConnections.map((conn) => (
                  <button
                    key={conn.id}
                    onClick={() => handleConnectionSelect(conn)}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 hover:border-accent-foreground/20 transition-colors text-left w-full"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <ProviderIcon provider={conn.provider} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{conn.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {conn.host}:{conn.port}/{conn.database}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 ml-4" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}