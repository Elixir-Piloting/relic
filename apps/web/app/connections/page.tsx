"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MainLayout } from "@/components/main-layout";
import { Button } from "@/components/ui/button";
import { Database, ArrowRight, Plus } from "lucide-react";
import { loadConnections } from "@/lib/connections/store";
import type { ConnectionConfig } from "@/lib/db/types";
import { useRouter } from "next/navigation";
import { ConnectionManager } from "@/components/connection-manager";
import { Persistence } from "@/lib/persistence";
import { SimpleNavbar } from "@/components/simple-navbar";

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [connectionManagerDialogOpen, setConnectionManagerDialogOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const refreshConnections = () => {
      const updatedConnections = loadConnections();
      setConnections(updatedConnections);
      
      // If no connections left, ensure active connection is cleared
      if (updatedConnections.length === 0) {
        Persistence.setActiveConnectionId(null);
      }
    };

    refreshConnections();

    // Periodically refresh connections (in case they're deleted from sidebar)
    const interval = setInterval(refreshConnections, 1000);
    return () => clearInterval(interval);
  }, []);

  // Refresh connections when dialog closes (in case a new one was added or deleted)
  const handleConnectionManagerClose = (open: boolean) => {
    setConnectionManagerDialogOpen(open);
    if (!open) {
      // Refresh connections list when dialog closes
      const updatedConnections = loadConnections();
      setConnections(updatedConnections);
      
      // If no connections left, ensure active connection is cleared
      if (updatedConnections.length === 0) {
        Persistence.setActiveConnectionId(null);
      }
    }
  };


  const handleConnect = async (conn: ConnectionConfig) => {
    try {
      const response = await fetch("/api/db/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conn),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error("Connection failed", {
          description: error.error,
        });
        return;
      }

      toast.success("Connected successfully");
      router.push(`/db/${conn.id}/query`);
    } catch (error) {
      toast.error("Connection failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <MainLayout>
      <SimpleNavbar />
      {connections.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="space-y-2">
              <Database className="h-16 w-16 mx-auto opacity-50 text-muted-foreground" />
              <h1 className="text-2xl font-semibold">No Connections</h1>
              <p className="text-muted-foreground">
                Create your first database connection to get started
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => setConnectionManagerDialogOpen(true)}
              className="w-full"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Connection
            </Button>
            {connectionManagerDialogOpen && (
              <ConnectionManager
                defaultOpen={true}
                onDialogChange={(open) => {
                  setConnectionManagerDialogOpen(open);
                  if (!open) {
                    // Refresh connections when dialog closes
                    setConnections(loadConnections());
                  }
                }}
                onConnectionSelect={async (config) => {
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

                    toast.success("Connected successfully");
                    router.push(`/db/${config.id}/query`);
                  } catch (error) {
                    toast.error("Connection failed", {
                      description: error instanceof Error ? error.message : "Unknown error",
                    });
                  }
                }}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-2">Database Connections</h1>
              <p className="text-muted-foreground">
                Manage your database connections
              </p>
            </div>

            <div className="space-y-2">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{conn.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {conn.host}:{conn.port} / {conn.database}
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => handleConnect(conn)}>
                    Connect
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <ConnectionManager
              onDialogChange={(open) => {
                if (!open) {
                  // Refresh connections when dialog closes
                  setConnections(loadConnections());
                }
              }}
              onConnectionSelect={async (config) => {
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

                  toast.success("Connected successfully");
                  router.push(`/db/${config.id}/query`);
                } catch (error) {
                  toast.error("Connection failed", {
                    description: error instanceof Error ? error.message : "Unknown error",
                  });
                }
              }}
            />
          </div>
        </div>
      )}
    </MainLayout>
  );
}
