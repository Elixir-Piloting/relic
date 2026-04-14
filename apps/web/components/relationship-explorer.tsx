"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Database, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ForeignKeyRelationship } from "@/lib/schema/relationships";

interface RelationshipExplorerProps {
  connectionId?: string;
  schema: string;
  table: string;
  onTableSelect?: (schema: string, table: string) => void;
}

export function RelationshipExplorer({
  connectionId,
  schema,
  table,
  onTableSelect,
}: RelationshipExplorerProps) {
  const [outgoing, setOutgoing] = useState<ForeignKeyRelationship[]>([]);
  const [incoming, setIncoming] = useState<ForeignKeyRelationship[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!connectionId || !schema || !table) {
      setOutgoing([]);
      setIncoming([]);
      return;
    }

    loadRelationships();
  }, [connectionId, schema, table]);

  const loadRelationships = async () => {
    setLoading(true);
    try {
      const [outgoingRes, incomingRes] = await Promise.all([
        fetch(`/api/db/relationships?schema=${schema}&table=${table}&type=outgoing`),
        fetch(`/api/db/relationships?schema=${schema}&table=${table}&type=incoming`),
      ]);

      if (outgoingRes.ok) {
        const data = await outgoingRes.json();
        setOutgoing(data.relationships || []);
      }

      if (incomingRes.ok) {
        const data = await incomingRes.json();
        setIncoming(data.relationships || []);
      }
    } catch (error) {
      console.error("Failed to load relationships:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!connectionId) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        {outgoing.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              References
            </div>
            <div className="space-y-2">
              {outgoing.map((rel, idx) => (
                <button
                  key={idx}
                  onClick={() => onTableSelect?.(rel.toSchema, rel.toTable)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors text-left group border border-transparent hover:border-border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {rel.fromColumn}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {rel.toSchema}.{rel.toTable}.{rel.toColumn}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {incoming.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              Referenced By
            </div>
            <div className="space-y-2">
              {incoming.map((rel, idx) => (
                <button
                  key={idx}
                  onClick={() => onTableSelect?.(rel.fromSchema, rel.fromTable)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors text-left group border border-transparent hover:border-border"
                >
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 rotate-180" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {rel.fromSchema}.{rel.fromTable}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {rel.fromColumn} → {rel.toColumn}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && outgoing.length === 0 && incoming.length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No relationships found
          </div>
        )}
      </div>
    </div>
  );
}
