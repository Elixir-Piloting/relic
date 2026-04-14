"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { DatabaseNavbar } from "@/components/database-navbar";
import { SchemaVisualizer } from "@/components/schema-visualizer";
import { getConnection } from "@/lib/connections/store";
import { Persistence } from "@/lib/persistence";
import type { ConnectionConfig } from "@/lib/db/types";

export default function VisualizerPage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.connection as string;
  const [connection, setConnection] = useState<ConnectionConfig | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const conn = getConnection(connectionId);
      if (conn) {
        setConnection(conn);
        Persistence.setActiveConnectionId(connectionId);
        Persistence.setActiveView(connectionId, "visualizer");
        fetch("/api/db/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(conn),
        }).catch(console.error);
      }
    }
  }, [connectionId]);

  // Redirect to connections page if connection not found (only after checking store)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!connectionId) return;
    
    // Check if connection exists in store - if it does, never redirect
    const conn = getConnection(connectionId);
    if (conn) {
      return; // Connection exists in store, let loading handle it
    }
    
    // Connection doesn't exist in store - redirect immediately
    // (No need to wait, if it's not in the store, it doesn't exist)
    const activeConnectionId = Persistence.getActiveConnectionId();
    if (activeConnectionId === connectionId) {
      Persistence.setActiveConnectionId(null);
    }
    router.push("/connections");
  }, [connectionId, router]); // Remove 'connection' from deps to avoid re-running when connection loads

  if (!connection) {
    return null; // Will redirect
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <DatabaseNavbar connectionId={connection.id} />
        <div className="flex-1 overflow-hidden">
          <SchemaVisualizer
            connectionId={connection.id}
            onTableSelect={(schema, table) => {
              window.location.href = `/db/${connection.id}?table=${schema}.${table}`;
            }}
          />
        </div>
      </div>
    </MainLayout>
  );
}
