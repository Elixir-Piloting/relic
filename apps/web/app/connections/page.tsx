"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MainLayout } from "@/components/main-layout";
import { Button } from "@/components/ui/button";
import { Database, ArrowRight, Plus } from "lucide-react";
import type { ConnectionConfig } from "@/lib/db/types";
import { useRouter } from "next/navigation";
import { ConnectionManager } from "@/components/connection-manager";
import { Persistence } from "@/lib/persistence";
import { SimpleNavbar } from "@/components/simple-navbar";
import { useConnections } from "@/lib/query/hooks/use-connections";

export default function ConnectionsPage() {
  const [connectionManagerDialogOpen, setConnectionManagerDialogOpen] = useState(false);
  const router = useRouter();
  const { data: connections = [], isLoading, refetch } = useConnections();

  const handleConnectionManagerClose = (open: boolean) => {
    setConnectionManagerDialogOpen(open);
    if (!open) {
      refetch();
    }
  };

  const handleConnectionSelect = (config: ConnectionConfig) => {
    Persistence.setActiveConnectionId(config.id);
    const lastView = Persistence.getActiveView(config.id) || "tables";
    router.push(`/db/${config.id}${lastView === "query" ? "/query" : lastView === "visualizer" ? "/visualizer" : ""}`);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <SimpleNavbar />
        <div className="flex-1 flex items-center justify-center">
          <Database className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <SimpleNavbar />
      <div className="flex-1 p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold">Connections</h1>
              <p className="text-muted-foreground">Manage your database connections</p>
            </div>
            <Button
              onClick={() => setConnectionManagerDialogOpen(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Connection
            </Button>
          </div>

          {connections.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-12 w-12 mx-auto opacity-50 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No connections yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first database connection to get started.
              </p>
              <Button onClick={() => setConnectionManagerDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => handleConnectionSelect(conn)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Database className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">{conn.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {conn.host}:{conn.port}/{conn.database}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConnectionManager
        onConnectionSelect={handleConnectionSelect}
        dialogOpen={connectionManagerDialogOpen}
        onDialogChange={handleConnectionManagerClose}
      />
    </MainLayout>
  );
}
