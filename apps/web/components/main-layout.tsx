"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import { ConnectionManager } from "@/components/connection-manager";
import { SchemaExplorer } from "@/components/schema-explorer";
import { AppLogo } from "@/components/app-logo";
import { Persistence } from "@/lib/persistence";
import { getConnection, loadConnections } from "@/lib/connections/store";
import { SidebarProvider, useSidebar } from "@/components/sidebar-context";
import { cn } from "@/lib/utils";
import type { ConnectionConfig } from "@/lib/db/types";

interface MainLayoutProps {
  children: React.ReactNode;
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentConnection, setCurrentConnection] =
    useState<ConnectionConfig | null>(null);
  const { collapsed: sidebarCollapsed } = useSidebar();

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
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [currentConnection]);

  const handleConnectionSelect = async (config: ConnectionConfig) => {
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
      
      // Navigate to last view for this connection
      const lastView = Persistence.getActiveView(config.id) || "tables";
      router.push(`/db/${config.id}${lastView === "query" ? "/query" : lastView === "visualizer" ? "/visualizer" : ""}`);
    } catch (error) {
      toast.error("Connection failed", {
        description: error instanceof Error ? error.message : "Unknown error",
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
        <div className="h-12 border-b border-border flex items-center gap-3 px-4 py-2 shrink-0">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              router.push("/");
            }}
            className="w-8 h-8 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <AppLogo />
          </a>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              router.push("/");
            }}
            className="text-lg font-semibold cursor-pointer hover:opacity-80 transition-opacity"
          >
            Relic
          </a>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 border-b border-border">
            <ConnectionManager
              onConnectionSelect={handleConnectionSelect}
              currentConnectionId={currentConnection?.id}
            />
          </div>
          <div className="p-6">
            <SchemaExplorer
              connectionId={currentConnection?.id}
              onTableSelect={(schema, table) => {
                // Navigate to database view with table (client-side, no refresh)
                if (currentConnection) {
                  router.push(`/db/${currentConnection.id}?table=${schema}.${table}`);
                }
              }}
              onTableCreated={() => {
                // Could trigger a refresh of the schema explorer
                window.location.reload();
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
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
