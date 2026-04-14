"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import { ConnectionManager } from "@/components/connection-manager";
import { SchemaExplorer } from "@/components/schema-explorer";
import { Persistence } from "@/lib/persistence";
import { getConnection, loadConnections } from "@/lib/connections/store";
import { SidebarProvider, useSidebar } from "@/components/sidebar-context";
import { cn } from "@/lib/utils";
import { DatabaseProvider, getProviderMetadata } from "@/lib/db/providers";
import type { ConnectionConfig } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Database, ChevronDown, Loader2, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSubtleBackground } from "@/lib/utils/color";
import { Breadcrumbs } from "@/components/breadcrumbs";

interface MainLayoutProps {
  children: React.ReactNode;
}

function ProviderIcon({ provider }: { provider: DatabaseProvider }) {
  const meta = getProviderMetadata(provider);
  
  return (
    <div 
      className="relative w-5 h-5 shrink-0 rounded-sm flex items-center justify-center"
      style={{
        backgroundColor: getSubtleBackground(meta.color, 1.0),
      }}
    >
      <img
        src={meta.icon}
        alt={meta.name}
        className="w-full h-full object-contain p-0.5"
        onError={(e) => {
          const parent = e.currentTarget.parentElement;
          if (parent) {
            parent.innerHTML = `<span class="text-xs font-bold" style="color: ${meta.color === '#FFFFFF' || meta.color === '#000000' ? '#1d1d1f' : '#fff'}">${meta.name.charAt(0)}</span>`;
          }
        }}
      />
    </div>
  );
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentConnection, setCurrentConnection] =
    useState<ConnectionConfig | null>(null);
  const { collapsed: sidebarCollapsed } = useSidebar();
  const [isPending, startTransition] = useTransition();
  const [isConnectionLoading, setIsConnectionLoading] = useState(false);
  const [connectionsPopoverOpen, setConnectionsPopoverOpen] = useState(false);
  const [connectionsRefreshKey, setConnectionsRefreshKey] = useState(0);

  // Refresh connections list when popover opens
  useEffect(() => {
    if (connectionsPopoverOpen) {
      setConnectionsRefreshKey((k) => k + 1);
    }
  }, [connectionsPopoverOpen]);

  // Restore active connection on mount and when pathname changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const activeConnectionId = Persistence.getActiveConnectionId();
    if (activeConnectionId) {
      const conn = getConnection(activeConnectionId);
      if (conn) {
        setCurrentConnection(conn);
        // Auto-connect in background and wait for it to complete
        fetch("/api/db/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(conn),
        })
          .then((res) => {
            if (res.ok) {
              // Connection established, schema explorer will load automatically
            }
          })
          .catch(console.error);
      } else {
        // Connection no longer exists, clear it
        Persistence.setActiveConnectionId(null);
        setCurrentConnection(null);
      }
    } else {
      setCurrentConnection(null);
    }
  }, [pathname]);

  // Periodically check if current connection still exists (in case it was deleted)
  // Use slower polling - 5 seconds is sufficient for database management app
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!currentConnection) return;

    const interval = setInterval(() => {
      const activeConnectionId = Persistence.getActiveConnectionId();
      if (activeConnectionId && activeConnectionId !== currentConnection.id) {
        // Active connection changed, refresh
        const conn = getConnection(activeConnectionId);
        if (conn) {
          setCurrentConnection(conn);
        } else {
          setCurrentConnection(null);
        }
        return;
      }

      // Check if current connection still exists
      const conn = getConnection(currentConnection.id);
      if (!conn) {
        // Connection was deleted
        Persistence.setActiveConnectionId(null);
        setCurrentConnection(null);
      }
    }, 5000); // Check every 5 seconds - sufficient for this use case

    return () => clearInterval(interval);
  }, [currentConnection]);

  const handleConnectionSelect = async (config: ConnectionConfig) => {
    setIsConnectionLoading(true);
    try {
      const response = await fetch("/api/db/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error("Connection failed", {
          description: error.error,
        });
        return;
      }

      setCurrentConnection(config);
      Persistence.setActiveConnectionId(config.id);
      toast.success("Connected successfully");
      
      // Close popover
      setConnectionsPopoverOpen(false);
      
      // Navigate to last view for this connection using transitions
      const lastView = Persistence.getActiveView(config.id) || "tables";
      startTransition(() => {
        router.push(`/db/${config.id}${lastView === "query" ? "/query" : lastView === "visualizer" ? "/visualizer" : ""}`);
      });
    } catch (error) {
      toast.error("Connection failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsConnectionLoading(false);
    }
  };

  const handleTableSelect = (schema: string, table: string) => {
    // Navigate to database view with table (client-side, no refresh)
    if (currentConnection) {
      startTransition(() => {
        router.push(`/db/${currentConnection.id}?table=${schema}.${table}`);
      });
    }
  };

  // Load all connections for the popover (refresh when dialog changes)
  const allConnections = connectionsRefreshKey >= 0 ? loadConnections() : [];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left Sidebar */}
      <div
        className={cn(
          "border-r border-border flex flex-col transition-all duration-200 ease-in-out",
          sidebarCollapsed ? "w-0 overflow-hidden" : "w-64",
          "shrink-0"
        )}
      >
        {/* Connection selector - fixed at top */}
        <div className="p-4 shrink-0">
          <Popover open={connectionsPopoverOpen} onOpenChange={setConnectionsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between h-10 px-3"
              >
                {currentConnection ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <ProviderIcon provider={currentConnection.provider} />
                    <span className="truncate">{currentConnection.name}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Select connection</span>
                )}
                <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-1" align="start">
              <div className="px-2 py-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Connections
                </p>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {allConnections.map((conn) => (
                  <button
                    key={conn.id}
                    onClick={() => handleConnectionSelect(conn)}
                    disabled={isConnectionLoading}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      currentConnection?.id === conn.id && "bg-accent text-accent-foreground"
                    )}
                  >
                    <ProviderIcon provider={conn.provider} />
                    <span className="truncate">{conn.name}</span>
                  </button>
                ))}
                {allConnections.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                    No connections
                  </p>
                )}
              </div>
              <div className="border-t mt-1 pt-1 px-1">
                <ConnectionManager
                  onConnectionSelect={handleConnectionSelect}
                  currentConnectionId={currentConnection?.id}
                  compact
                  onDialogChange={(open) => {
                    if (!open) setConnectionsPopoverOpen(false);
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {/* Schema explorer - scrollable */}
        <ScrollArea className="flex-1 p-4">
          <SchemaExplorer
            connectionId={currentConnection?.id}
            onTableSelect={handleTableSelect}
            onTableCreated={() => {
              // Refresh schema - the SchemaExplorer will handle this internally
              // No need for full page reload
            }}
          />
        </ScrollArea>
        {/* Settings link */}
        <div className="p-2 shrink-0">
          <a
            href="/settings"
            onClick={(e) => {
              e.preventDefault();
              startTransition(() => router.push("/settings"));
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Settings className="h-4 w-4" />
            Settings
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Breadcrumb navigation */}
        <div className="h-10 border-b border-border flex items-center px-6 shrink-0 bg-muted/10">
          <Breadcrumbs />
        </div>
        {children}
      </div>
    </div>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </SidebarProvider>
  );
}
