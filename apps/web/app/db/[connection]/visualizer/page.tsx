"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { DatabaseNavbar } from "@/components/database-navbar";
import { SchemaVisualizer } from "@/components/schema-visualizer";
import { Persistence } from "@/lib/persistence";
import type { ConnectionConfig } from "@/lib/db/types";
import { getConnectionAsync } from "@/lib/connections/store";

export default function VisualizerPage() {
  const params = useParams();
  const connectionId = params.connection as string;
  const [connection, setConnection] = useState<ConnectionConfig | null>(null);
  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initializedRef.current === connectionId) return;

    getConnectionAsync(connectionId).then(conn => {
      if (!conn) {
        return;
      }

      initializedRef.current = connectionId;
      setConnection(conn);
      Persistence.setActiveConnectionId(connectionId);
      Persistence.setActiveView(connectionId, "visualizer");

      fetch("/api/db/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conn),
      }).catch(console.error);
    });
  }, [connectionId]);

  if (!connection && !initializedRef.current) {
    return (
      <MainLayout>
        <div className="flex flex-col h-full">
          <DatabaseNavbar connectionId="" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!connection) {
    return null;
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <DatabaseNavbar connectionId={connection.id} />
        <div className="flex-1">
          <SchemaVisualizer connectionId={connection.id} />
        </div>
      </div>
    </MainLayout>
  );
}
