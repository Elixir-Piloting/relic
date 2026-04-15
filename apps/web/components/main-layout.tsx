"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import { ConnectionManager } from "@/components/connection-manager";
import { SchemaExplorer } from "@/components/schema-explorer";
import { Persistence } from "@/lib/persistence";
import { preloadConnection } from "@/lib/connections/store";
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
import { Plus, Database, ChevronDown, Loader2, Settings, Pencil, Home } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSubtleBackground } from "@/lib/utils/color";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useConnections } from "@/lib/query/hooks/use-connections";
import { useConnect } from "@/lib/query/mutations/use-connect";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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
  const queryClient = useQueryClient();
  const { collapsed: sidebarCollapsed } = useSidebar();
  const [isPending, startTransition] = useTransition();
  const [connectionsPopoverOpen, setConnectionsPopoverOpen] = useState(false);
  const [connectionsRefreshKey, setConnectionsRefreshKey] = useState(0);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);

  const [currentConnection, setCurrentConnection] = useState<ConnectionConfig | null>(null);

  const { data: connectionsData, isLoading: connectionsLoading } = useConnections();
  const connections = Array.isArray(connectionsData) ? connectionsData : [];
  const connectMutation = useConnect();

  useEffect(() => {
    if (connections.length > 0) {
      connections.forEach(conn => preloadConnection(conn));
    }
  }, [connections]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const activeConnectionId = Persistence.getActiveConnectionId();
    if (activeConnectionId && connections.length > 0) {
      const conn = connections.find(c => c.id === activeConnectionId);
      if (conn) {
        setCurrentConnection(conn);
      }
    }
  }, [connections]);

  const handleConnectionSelect = async (config: ConnectionConfig) => {
    try {
      await connectMutation.mutateAsync({ config });
      setCurrentConnection(config);
      Persistence.setActiveConnectionId(config.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.db.schema(config.id) });
      toast.success("Connected successfully");
      
      setConnectionsPopoverOpen(false);
      
      const lastView = Persistence.getActiveView(config.id) || "tables";
      startTransition(() => {
        router.push(`/db/${config.id}${lastView === "query" ? "/query" : lastView === "visualizer" ? "/visualizer" : ""}`);
      });
    } catch (error) {
      toast.error("Connection failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleTableSelect = (schema: string, table: string) => {
    if (currentConnection) {
      startTransition(() => {
        router.push(`/db/${currentConnection.id}?table=${schema}.${table}`);
      });
    }
  };

  const handleOpenNewTableTab = (schema: string) => {
    if (currentConnection) {
      startTransition(() => {
        router.push(`/db/${currentConnection.id}?newTable=${schema}`);
      });
    }
  };

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
                {(connections || []).map((conn) => (
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
                      disabled={connectMutation.isPending}
                      className="flex items-center gap-2 min-w-0 flex-1"
                    >
                      <ProviderIcon provider={conn.provider} />
                      <span className="truncate">{conn.name}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/add-connection/${conn.provider}?connectionId=${conn.id}`);
                        setConnectionsPopoverOpen(false);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent-foreground/10 rounded transition-opacity"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {connections.length === 0 && !connectionsLoading && (
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
          />
        </ScrollArea>
        {/* Settings and Home row */}
        <div className="p-2 shrink-0">
          <TooltipProvider>
            <div className="flex space-x-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startTransition(() => router.push("/"))}
                    className="h-8 w-8"
                    aria-label="Home"
                  >
                    <Home className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Home</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      startTransition(() => router.push("/settings"));
                    }}
                    className="h-8 w-8"
                    aria-label="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Settings</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
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
