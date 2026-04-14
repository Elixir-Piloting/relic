"use client";

import { useState, useCallback, useEffect } from "react";
import { TableNode, RelationshipEdge, ColumnInfo, TABLE_HEADER_HEIGHT, COLUMN_HEIGHT, TABLE_MIN_WIDTH, TABLE_PADDING } from "./constants";

export function useSchemaLoader(connectionId: string | undefined) {
  const [tables, setTables] = useState<TableNode[]>([]);
  const [relationships, setRelationships] = useState<RelationshipEdge[]>([]);
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);
  const [currentSchema, setCurrentSchema] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadAllSchemas = useCallback(async (schemaToLoad?: string | null) => {
    setIsLoading(true);
    try {
      try {
        const statusRes = await fetch("/api/db/status");
        const statusData = await statusRes.json();
        if (!statusData.connected && connectionId) {
          const { getConnection } = await import("@/lib/connections/store");
          const conn = getConnection(connectionId);
          if (conn) {
            try {
              await fetch("/api/db/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(conn),
              });
              await new Promise((resolve) => setTimeout(resolve, 300));
            } catch (reconnectError) {
              console.error("Failed to reconnect:", reconnectError);
            }
          }
        }
      } catch (statusError) {
        console.error("Failed to check connection status:", statusError);
      }

      const schemasRes = await fetch("/api/db/schema");
      if (!schemasRes.ok) {
        const errorData = await schemasRes.json().catch(() => ({}));
        const errorMsg = errorData.error || "Failed to load schemas";
        console.error("Failed to load schemas:", errorMsg);

        if (
          errorMsg.includes("No database connection") ||
          errorMsg.includes("closed") ||
          errorMsg.includes("not queryable") ||
          errorMsg.includes("Connection terminated") ||
          errorMsg.includes("terminated")
        ) {
          setAvailableSchemas([]);
          setTables([]);
          setRelationships([]);
          setIsLoading(false);
          return;
        }

        setIsLoading(false);
        return;
      }

      const schemasData = await schemasRes.json().catch(() => ({ schemas: [] }));
      const schemas = schemasData.schemas || [];

      const sortedSchemas = [...schemas].sort((a, b) => {
        if (a === "public") return -1;
        if (b === "public") return 1;
        return a.localeCompare(b);
      });

      setAvailableSchemas(sortedSchemas);

      if (sortedSchemas.length === 0) {
        setTables([]);
        setRelationships([]);
        setIsLoading(false);
        return;
      }

      let selectedSchema = schemaToLoad || currentSchema;
      if (!selectedSchema || !sortedSchemas.includes(selectedSchema)) {
        selectedSchema = sortedSchemas[0];
        setCurrentSchema(selectedSchema);
      }

      if (!selectedSchema) {
        setTables([]);
        setRelationships([]);
        setIsLoading(false);
        return;
      }

      const tablesRes = await fetch(`/api/db/schema?schema=${encodeURIComponent(selectedSchema)}`);
      if (!tablesRes.ok) {
        setTables([]);
        setRelationships([]);
        setIsLoading(false);
        return;
      }

      const tablesData = await tablesRes.json();
      if (tablesData.error) {
        setTables([]);
        setRelationships([]);
        setIsLoading(false);
        return;
      }

      const flatTables = (tablesData.tables || []).map((table: any) => ({ ...table, schema: selectedSchema }));

      if (flatTables.length === 0) {
        setTables([]);
        setRelationships([]);
        setIsLoading(false);
        return;
      }

      const allTables: TableNode[] = [];
      let tableIndex = 0;

      for (const table of flatTables) {
        try {
          const columnsRes = await fetch("/api/db/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `SELECT c.column_name, c.data_type, c.is_nullable,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
                CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key
              FROM information_schema.columns c
              LEFT JOIN (
                SELECT ku.column_name FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
                WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1 AND tc.table_name = $2
              ) pk ON c.column_name = pk.column_name
              LEFT JOIN (
                SELECT ku.column_name FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1 AND tc.table_name = $2
              ) fk ON c.column_name = fk.column_name
              WHERE c.table_schema = $1 AND c.table_name = $2 ORDER BY c.ordinal_position`,
              params: [table.schema, table.name],
            }),
          });

          let columns: ColumnInfo[] = [];
          if (columnsRes.ok) {
            const columnsData = await columnsRes.json();
            if (columnsData.success) {
              columns = columnsData.data.rows.map((r: any) => ({
                name: r.column_name,
                type: r.data_type,
                isPrimaryKey: r.is_primary_key,
                isForeignKey: r.is_foreign_key,
                isNullable: r.is_nullable === "YES",
              }));
            }
          }

          const columnCount = columns.length;
          const tableHeight = TABLE_HEADER_HEIGHT + (columnCount * COLUMN_HEIGHT) + TABLE_PADDING;
          const maxNameLength = Math.max(...columns.map((c) => c.name.length), 10);
          const maxTypeLength = Math.max(...columns.map((c) => c.type.length), 15);
          const calculatedWidth = Math.max(TABLE_MIN_WIDTH, Math.max(maxNameLength * 7, maxTypeLength * 6) + 60);
          const tableWidth = Math.min(calculatedWidth, 350);

          allTables.push({
            id: `${table.schema}.${table.name}`,
            schema: table.schema,
            name: table.name,
            columns,
            x: (tableIndex % 6) * 280 + 50,
            y: Math.floor(tableIndex / 6) * 250 + 50,
            width: tableWidth,
            height: tableHeight,
            zIndex: 0,
          });
          tableIndex++;
        } catch (err) {
          console.error(`Failed to load columns for ${table.schema}.${table.name}:`, err);
        }
      }

      setTables(allTables);

      const allRelationships: RelationshipEdge[] = [];
      const relationshipPromises = allTables.map(async (table) => {
        try {
          const [outgoingRes, incomingRes] = await Promise.all([
            fetch(
              `/api/db/relationships?schema=${encodeURIComponent(table.schema)}&table=${encodeURIComponent(table.name)}&type=outgoing`
            ).catch(() => null),
            fetch(
              `/api/db/relationships?schema=${encodeURIComponent(table.schema)}&table=${encodeURIComponent(table.name)}&type=incoming`
            ).catch(() => null),
          ]);

          if (outgoingRes?.ok) {
            try {
              const outgoingData = await outgoingRes.json();
              outgoingData.relationships?.forEach((rel: any) => {
                const relId = `${rel.fromSchema}.${rel.fromTable}-${rel.toSchema}.${rel.toTable}-${rel.fromColumn}`;
                if (!allRelationships.find((r) => r.id === relId)) {
                  allRelationships.push({
                    id: relId,
                    from: `${rel.fromSchema}.${rel.fromTable}`,
                    to: `${rel.toSchema}.${rel.toTable}`,
                    fromColumn: rel.fromColumn || rel.from_column,
                    toColumn: rel.toColumn || rel.to_column,
                    constraintName: rel.constraintName || rel.constraint_name,
                    relationshipType: "Foreign Key",
                  });
                }
              });
            } catch {}
          }

          if (incomingRes?.ok) {
            try {
              const incomingData = await incomingRes.json();
              incomingData.relationships?.forEach((rel: any) => {
                const relId = `${rel.fromSchema}.${rel.fromTable}-${rel.toSchema}.${rel.toTable}-${rel.fromColumn}`;
                if (!allRelationships.find((r) => r.id === relId)) {
                  allRelationships.push({
                    id: relId,
                    from: `${rel.fromSchema}.${rel.fromTable}`,
                    to: `${rel.toSchema}.${rel.toTable}`,
                    fromColumn: rel.fromColumn || rel.from_column,
                    toColumn: rel.toColumn || rel.to_column,
                    constraintName: rel.constraintName || rel.constraint_name,
                    relationshipType: "Foreign Key",
                  });
                }
              });
            } catch {}
          }
        } catch {}
      });

      await Promise.all(relationshipPromises);

      const filteredRelationships = allRelationships.filter((rel) => {
        const fromParts = rel.from.split(".");
        const toParts = rel.to.split(".");
        return fromParts[0] === selectedSchema && toParts[0] === selectedSchema;
      });

      setRelationships(filteredRelationships);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load schema:", error);
      setTables([]);
      setRelationships([]);
      setIsLoading(false);
    }
  }, [connectionId, currentSchema]);

  useEffect(() => {
    if (!connectionId) {
      setTables([]);
      setRelationships([]);
      setAvailableSchemas([]);
      setCurrentSchema(null);
      return;
    }

    const timer = setTimeout(() => {
      loadAllSchemas(currentSchema);
    }, 300);

    return () => clearTimeout(timer);
  }, [connectionId, currentSchema, loadAllSchemas]);

  return {
    tables,
    relationships,
    availableSchemas,
    currentSchema,
    setCurrentSchema,
    isLoading,
    loadSchema: loadAllSchemas,
  };
}