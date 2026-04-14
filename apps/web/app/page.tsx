"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Button } from "@/components/ui/button";
import { Database, Plus } from "lucide-react";
import type { ConnectionConfig } from "@/lib/db/types";
import { ConnectionManager } from "@/components/connection-manager";
import { Persistence } from "@/lib/persistence";
import { SimpleNavbar } from "@/components/simple-navbar";
import { useConnections } from "@/lib/query/hooks/use-connections";

export default function Home() {
  const router = useRouter();
  const { data: connections = [], isLoading } = useConnections();

  useEffect(() => {
    if (isLoading) return;
    
    if (connections.length === 0) {
      return;
    }

    const activeConnectionId = Persistence.getActiveConnectionId();
    if (activeConnectionId) {
      const conn = connections.find((c) => c.id === activeConnectionId);
      if (conn) {
        const lastView = Persistence.getActiveView(activeConnectionId) || "tables";
        router.push(`/db/${activeConnectionId}${lastView === "query" ? "/query" : lastView === "visualizer" ? "/visualizer" : ""}`);
        return;
      }
    }

    router.push("/connections");
  }, [connections, isLoading, router]);

  if (isLoading || connections.length === 0) {
    return (
      <MainLayout>
        <SimpleNavbar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="space-y-2">
              <Database className="h-16 w-16 mx-auto opacity-50 text-muted-foreground" />
              <h2 className="text-2xl font-semibold">No connections yet</h2>
              <p className="text-muted-foreground">
                Create your first database connection to get started.
              </p>
            </div>
            <ConnectionManager
              onConnectionSelect={(config) => {
                Persistence.setActiveConnectionId(config.id);
                router.push(`/db/${config.id}`);
              }}
            />
          </div>
        </div>
      </MainLayout>
    );
  }

  return null;
}
