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
import { SchemaRefreshProvider, useSchemaRefresh } from "@/components/schema-refresh-context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Database, ChevronDown, Loader2, Settings, Pencil } from "lucide-react";
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
      className="relative w-4 h-4 shrink-0 rounded-sm flex items-center justify-center"
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
            parent.innerHTML = `<span class="text-[8px] font-bold" style="color: ${meta.color === '#FFFFFF' || meta.color === '#000000' ? '#1d1d1f' : '#fff'}">${meta.name.charAt(0)}</span>`;
          }
        }}
      />
    </div>
  );
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { triggerRefresh } = useSchemaRefresh();
  const [currentConnection, setCurrentConnection] =
    useState<ConnectionConfig | null>(null);
  const { collapsed: sidebarCollapsed } = useSidebar();
  const [isPending, startTransition] = useTransition();
  const [isConnectionLoading, setIsConnectionLoading] = useState(false);
  const [connectionsPopoverOpen, setConnectionsPopoverOpen] = useState(false);
  const [connectionsRefreshKey, setConnectionsRefreshKey] = useState(0);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);
  const [schemaRefreshKey, setSchemaRefreshKey] = useState(0);

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

  const handleOpenNewTableTab = (schema: string) => {
    // Navigate to database view with new table tab
    if (currentConnection) {
      startTransition(() => {
        router.push(`/db/${currentConnection.id}?newTable=${schema}`);
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
        <div className="px-4 py-4 shrink-0">
          <Popover open={connectionsPopoverOpen} onOpenChange={setConnectionsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between h-8 px-3 text-sm border-0 shadow-none focus:ring-0"
              >
                {currentConnection ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <ProviderIcon provider={currentConnection.provider} />
                    <span className="truncate">{currentConnection.name}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground truncate">Select connection</span>
                )}
                <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <div className="max-h-[200px] overflow-y-auto">
                {allConnections.map((conn) => (
                  <div
                    key={conn.id}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors group",
                      "hover:bg-accent hover:text-accent-foreground",
                      currentConnection?.id === conn.id && "bg-accent text-accent-foreground"
                    )}
                  >
                    <button
                      onClick={() => handleConnectionSelect(conn)}
                      disabled={isConnectionLoading}
                      className="flex items-center gap-2 min-w-0 flex-1"
                    >
                      <ProviderIcon provider={conn.provider} />
                      <span className="truncate">{conn.name}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingConnection(conn);
                        setConnectionDialogOpen(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent-foreground/10 rounded transition-opacity"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {allConnections.length === 0 && (
                  <p className="px-3 py-3 text-sm text-muted-foreground text-center">
                    No connections
                  </p>
                )}
              </div>
              <div className="border-t px-1">
                <ConnectionManager
                  onConnectionSelect={handleConnectionSelect}
                  currentConnectionId={currentConnection?.id}
                  compact
                  dialogOpen={connectionDialogOpen}
                  onDialogOpenChange={(open) => {
                    setConnectionDialogOpen(open);
                    if (!open) {
                      setConnectionsPopoverOpen(false);
                      setEditingConnection(null);
                    }
                  }}
                  externalEditingConnection={editingConnection}
                  onEditConnection={setEditingConnection}
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
            onOpenNewTableTab={handleOpenNewTableTab}
            onTableCreated={triggerRefresh}
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
      <SchemaRefreshProvider>
        <MainLayoutContent>{children}</MainLayoutContent>
      </SchemaRefreshProvider>
    </SidebarProvider>
  );
}
