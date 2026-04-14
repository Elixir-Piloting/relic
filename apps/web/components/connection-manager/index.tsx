"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Persistence } from "@/lib/persistence";
import type { ConnectionConfig } from "@/lib/db/types";
import { DatabaseProvider } from "@/lib/db/providers";
import { getAllConnections, deleteConnection as dbDeleteConnection } from "@/lib/db/indexeddb";
import { ConnectionList } from "./ConnectionList";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { useConnections, useDeleteConnection } from "@/lib/query/hooks/use-connections";

interface ConnectionManagerProps {
  onConnectionSelect: (config: ConnectionConfig) => void;
  currentConnectionId?: string;
  defaultOpen?: boolean;
  onDialogChange?: (open: boolean) => void;
  compact?: boolean;
  dialogOpen?: boolean;
  onDialogOpenChange?: (open: boolean) => void;
  externalEditingConnection?: ConnectionConfig | null;
  onEditConnection?: (connection: ConnectionConfig | null) => void;
}

const DEFAULT_FORM_DATA: Partial<ConnectionConfig> = {
  name: "",
  provider: DatabaseProvider.POSTGRESQL,
  host: "localhost",
  port: 5432,
  database: "",
  user: "",
  password: "",
  connectionString: "",
};

export function ConnectionManager({
  onConnectionSelect,
  currentConnectionId,
  defaultOpen = false,
  onDialogChange,
  compact = false,
  dialogOpen,
  onDialogOpenChange,
  externalEditingConnection,
  onEditConnection,
}: ConnectionManagerProps) {
  const router = useRouter();
  const [internalDialogOpen, setInternalDialogOpen] = useState(defaultOpen);
  const [internalEditingConnection, setInternalEditingConnection] = useState<ConnectionConfig | null>(null);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: connections = [], isLoading } = useConnections();
  const deleteConnectionMutation = useDeleteConnection();

  useEffect(() => {
    if (dialogOpen !== undefined) {
      setIsDialogOpen(dialogOpen);
    }
  }, [dialogOpen]);

  useEffect(() => {
    if (externalEditingConnection !== undefined) {
      setInternalEditingConnection(externalEditingConnection);
    }
  }, [externalEditingConnection]);

  const handleEdit = (conn: ConnectionConfig) => {
    router.push(`/add-connection/${conn.provider}?connectionId=${conn.id}`);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnectionToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (connectionToDelete) {
      const activeConnectionId = Persistence.getActiveConnectionId();
      if (activeConnectionId === connectionToDelete) {
        Persistence.setActiveConnectionId(null);
      }

      await deleteConnectionMutation.mutateAsync({ id: connectionToDelete });
      setConnectionToDelete(null);

      if (onDialogChange) {
        onDialogChange(false);
      }
    }
  };

  return (
    <div className={compact ? "py-1.5" : "space-y-3"}>
      {!compact && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Connections
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => router.push("/add-connection")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {compact && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-8 text-sm"
          onClick={() => router.push("/add-connection")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add connection
        </Button>
      )}

      {!compact && !isLoading && (
        <ConnectionList
          connections={connections}
          currentConnectionId={currentConnectionId}
          onSelect={onConnectionSelect}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Connection"
        description="Are you sure you want to delete this connection? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
