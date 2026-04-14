"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Persistence } from "@/lib/persistence";
import type { ConnectionConfig } from "@/lib/db/types";
import { DatabaseProvider } from "@/lib/db/providers";
import { loadConnections, saveConnection, deleteConnection } from "@/lib/connections/store";
import { ConnectionList } from "./ConnectionList";
import { ConnectionForm } from "./ConnectionForm";
import { ConfirmationDialog } from "@/components/confirmation-dialog";

interface ConnectionManagerProps {
  onConnectionSelect: (config: ConnectionConfig) => void;
  currentConnectionId?: string;
  defaultOpen?: boolean;
  onDialogChange?: (open: boolean) => void;
  compact?: boolean;
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
}: ConnectionManagerProps) {
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(defaultOpen);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (defaultOpen !== isDialogOpen) {
      setIsDialogOpen(defaultOpen);
    }
  }, [defaultOpen]);

  useEffect(() => {
    const conns = loadConnections();
    setConnections(conns);
  }, []);

  const handleEdit = (conn: ConnectionConfig) => {
    setEditingConnection(conn);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnectionToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (connectionToDelete) {
      const activeConnectionId = Persistence.getActiveConnectionId();
      if (activeConnectionId === connectionToDelete) {
        Persistence.setActiveConnectionId(null);
      }

      deleteConnection(connectionToDelete);
      const updatedConnections = loadConnections();
      setConnections(updatedConnections);
      setConnectionToDelete(null);

      if (updatedConnections.length === 0) {
        Persistence.setActiveConnectionId(null);
      }

      if (onDialogChange) {
        onDialogChange(false);
      }
    }
  };

  const handleConnectionCreated = (config: ConnectionConfig) => {
    setConnections(loadConnections());
    setEditingConnection(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Connections
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => {
            setEditingConnection(null);
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {!compact && (
        <ConnectionList
          connections={connections}
          currentConnectionId={currentConnectionId}
          onSelect={onConnectionSelect}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <ConnectionForm
        isOpen={isDialogOpen}
        editingConnection={editingConnection}
        onDialogChange={(open) => {
          setIsDialogOpen(open);
          onDialogChange?.(open);
          if (!open) {
            setEditingConnection(null);
          }
        }}
        onConnectionSelect={(config) => {
          setConnections(loadConnections());
          onConnectionSelect(config);
        }}
      />

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

export { ConnectionList } from "./ConnectionList";
export { ConnectionForm } from "./ConnectionForm";