"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Button } from "@/components/ui/button";
import { Database, Plus } from "lucide-react";
import { loadConnections } from "@/lib/connections/store";
import type { ConnectionConfig } from "@/lib/db/types";
import { ConnectionManager } from "@/components/connection-manager";
import { Persistence } from "@/lib/persistence";
import { toast } from "sonner";
import { SimpleNavbar } from "@/components/simple-navbar";

export default function Home() {
  const router = useRouter();
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [connectionManagerDialogOpen, setConnectionManagerDialogOpen] = useState(false);

  useEffect(() => {
    const connectionsList = loadConnections();
    setConnections(connectionsList);

    // If there are connections and an active one, redirect to it
    const activeConnectionId = Persistence.getActiveConnectionId();
    if (activeConnectionId && connectionsList.length > 0) {
      const conn = connectionsList.find((c) => c.id === activeConnectionId);
      if (conn) {
        const lastView = Persistence.getActiveView(activeConnectionId) || "tables";
        router.push(`/db/${activeConnectionId}${lastView === "query" ? "/query" : lastView === "visualizer" ? "/visualizer" : ""}`);
        return;
      }
    }

    // If there are connections but no active one, redirect to connections page
    if (connectionsList.length > 0) {
      router.push("/connections");
      return;
    }
  }, [router]);

  // If no connections, show the "no connections" screen
  if (connections.length === 0) {
    return (
      <MainLayout>
        <SimpleNavbar />
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
                    const updatedConnections = loadConnections();
                    setConnections(updatedConnections);

                    // If no connections left, ensure active connection is cleared
                    if (updatedConnections.length === 0) {
                      Persistence.setActiveConnectionId(null);
                    }
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
      </MainLayout>
    );
  }

  // Otherwise, redirecting (handled in useEffect)
  return null;
}
