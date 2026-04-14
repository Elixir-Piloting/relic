"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/app-logo";
import { LocalPostgresManager } from "@/components/local-postgres-manager";
import { ArrowLeft } from "lucide-react";
import type { ConnectionConfig } from "@/lib/db/types";
import { useSaveConnection } from "@/lib/query/hooks/use-connections";
import { Persistence } from "@/lib/persistence";
import { toast } from "sonner";

export default function LocalPostgresPage() {
  const router = useRouter();
  const saveConnectionMutation = useSaveConnection();

  const handleServerSelect = async (config: ConnectionConfig) => {
    try {
      await saveConnectionMutation.mutateAsync({ connection: config });
      Persistence.setActiveConnectionId(config.id);
      toast.success("Connected to local PostgreSQL");
      router.push(`/db/${config.id}`);
    } catch (error) {
      toast.error("Failed to connect", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleCreateDatabase = async (config: ConnectionConfig) => {
    try {
      await saveConnectionMutation.mutateAsync({ connection: config });
      Persistence.setActiveConnectionId(config.id);
      toast.success("Created and connected to database");
      router.push(`/db/${config.id}`);
    } catch (error) {
      toast.error("Failed to create database", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <div className="space-y-8 marketing-buttons marketing-inputs">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Local PostgreSQL</h1>
        <p className="text-muted-foreground">
          Connect to a PostgreSQL server running on your machine.
        </p>
      </div>

      <LocalPostgresManager
        onServerSelect={handleServerSelect}
        onCreateDatabase={handleCreateDatabase}
      />
    </div>
  );
}