"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Key, Download, ZoomIn, ZoomOut, Maximize2, Lock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ColumnInfo {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
}

interface TableNode {
  id: string;
  schema: string;
  name: string;
  columns: ColumnInfo[];
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number; // For rendering order
}

interface RelationshipEdge {
  id: string;
  from: string;
  to: string;
  fromColumn: string;
  toColumn: string;
  constraintName?: string;
  relationshipType?: string;
}

interface SchemaVisualizerProps {
  connectionId?: string;
  onTableSelect?: (schema: string, table: string) => void;
}

const TABLE_HEADER_HEIGHT = 32;
const COLUMN_HEIGHT = 24;
const TABLE_MIN_WIDTH = 220;
const TABLE_PADDING = 12;

export function SchemaVisualizer({
  connectionId,
  onTableSelect,
}: SchemaVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tables, setTables] = useState<TableNode[]>([]);
  const [relationships, setRelationships] = useState<RelationshipEdge[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTable, setDragTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panInitial, setPanInitial] = useState({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState(false);
  const [currentSchema, setCurrentSchema] = useState<string | null>(null);
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [schemaSearchTerm, setSchemaSearchTerm] = useState("");

  const loadAllSchemas = useCallback(async (schemaToLoad?: string | null) => {
    setIsLoading(true);
    try {
      // First check connection status and reconnect if needed
      try {
        const statusRes = await fetch("/api/db/status");
        const statusData = await statusRes.json();
        if (!statusData.connected && connectionId) {
          // Try to reconnect
          const { getConnection } = await import("@/lib/connections/store");
          const conn = getConnection(connectionId);
          if (conn) {
            try {
              await fetch("/api/db/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(conn),
              });
              // Wait a bit for connection to establish
              await new Promise((resolve) => setTimeout(resolve, 300));
            } catch (reconnectError) {
              console.error("Failed to reconnect:", reconnectError);
            }
          }
        }
      } catch (statusError) {
        console.error("Failed to check connection status:", statusError);
      }
      
      // Load all schemas
      const schemasRes = await fetch("/api/db/schema");
      if (!schemasRes.ok) {
        const errorData = await schemasRes.json().catch(() => ({}));
        const errorMsg = errorData.error || "Failed to load schemas";
        console.error("Failed to load schemas:", errorMsg);
        
        // If connection issue, just set empty schemas (don't show error if it's a connection problem)
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
      
      // Sort schemas to ensure "public" is always first
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

      // Determine which schema to load - use parameter first, then currentSchema, then first available
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

      const allTables: TableNode[] = [];
      let tableIndex = 0;

      // Load tables from selected schema only
      const tablesRes = await fetch(`/api/db/schema?schema=${encodeURIComponent(selectedSchema)}`);
      if (!tablesRes.ok) {
        const errorData = await tablesRes.json().catch(() => ({}));
        console.error("Failed to load tables:", errorData.error || "Unknown error");
        setTables([]);
        setRelationships([]);
        setIsLoading(false);
        return;
      }

      const tablesData = await tablesRes.json();
      if (tablesData.error) {
        console.error("Error in tables response:", tablesData.error);
        setTables([]);
        setRelationships([]);
        setIsLoading(false);
        return;
      }
      
      const flatTables = (tablesData.tables || []).map((table: any) => ({ ...table, schema: selectedSchema }));
      
      if (flatTables.length === 0) {
        console.warn(`No tables found in schema: ${selectedSchema}`);
        setTables([]);
        setRelationships([]);
        setIsLoading(false);
        return;
      }

      // Load columns for all tables
      for (const table of flatTables) {
        try {
          const columnsRes = await fetch("/api/db/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `SELECT 
                c.column_name,
                c.data_type,
                c.is_nullable,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
                CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key
              FROM information_schema.columns c
              LEFT JOIN (
                SELECT ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku
                  ON tc.constraint_name = ku.constraint_name
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = $1
                  AND tc.table_name = $2
              ) pk ON c.column_name = pk.column_name
              LEFT JOIN (
                SELECT ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku
                  ON tc.constraint_name = ku.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = $1
                  AND tc.table_name = $2
              ) fk ON c.column_name = fk.column_name
              WHERE c.table_schema = $1 AND c.table_name = $2
              ORDER BY c.ordinal_position`,
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
          // Calculate width based on longest column name and type
          const maxNameLength = Math.max(...columns.map(c => c.name.length), 10);
          const maxTypeLength = Math.max(...columns.map(c => c.type.length), 15);
          // Width = name area (45%) + type area (35%) + padding + icons (40px)
          const calculatedWidth = Math.max(
            TABLE_MIN_WIDTH,
            Math.max(maxNameLength * 7, maxTypeLength * 6) + 60
          );
          const tableWidth = Math.min(calculatedWidth, 350); // Cap at 350px for readability

          allTables.push({
            id: `${table.schema}.${table.name}`,
            schema: table.schema,
            name: table.name,
            columns,
            x: (tableIndex % 6) * 280 + 50,
            y: Math.floor(tableIndex / 6) * 250 + 50,
            width: tableWidth,
            height: tableHeight,
            zIndex: 0, // Default z-index
          });
          tableIndex++;
        } catch (err) {
          console.error(`Failed to load columns for ${table.schema}.${table.name}:`, err);
        }
      }

      setTables(allTables);

      // Load relationships for tables in the selected schema
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
            } catch (err) {
              console.error(`Failed to parse outgoing relationships for ${table.schema}.${table.name}:`, err);
            }
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
            } catch (err) {
              console.error(`Failed to parse incoming relationships for ${table.schema}.${table.name}:`, err);
            }
          }
        } catch (err) {
          // Silently fail - relationships are optional
          console.debug(`Failed to load relationships for ${table.schema}.${table.name}:`, err);
        }
      });

      // Wait for all relationship loads to complete
      await Promise.all(relationshipPromises);
      
      // Filter relationships to only show those within the selected schema
      // Use the selectedSchema variable that was already determined earlier
      const filteredRelationships = allRelationships.filter((rel) => {
        const fromParts = rel.from.split(".");
        const toParts = rel.to.split(".");
        // Show relationship if both tables are in the selected schema
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
  }, []);

  useEffect(() => {
    if (!connectionId) {
      setTables([]);
      setRelationships([]);
      setAvailableSchemas([]);
      setCurrentSchema(null);
      return;
    }

    // Small delay to ensure connection is established, then load schemas
    const timer = setTimeout(() => {
      loadAllSchemas(currentSchema);
    }, 300);

    return () => clearTimeout(timer);
  }, [connectionId, currentSchema, loadAllSchemas]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    // Get display size (CSS pixels) - account for device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    // Enable crisp text rendering
    ctx.textBaseline = "middle";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Clear canvas with background color
    ctx.fillStyle = "hsl(240, 10%, 4%)";
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Apply zoom and pan
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw relationships (edges) first so they appear behind tables
    relationships.forEach((rel) => {
      const fromTable = tables.find((t) => t.id === rel.from);
      const toTable = tables.find((t) => t.id === rel.to);

      if (!fromTable || !toTable) return;

      // Find column positions
      const fromColumnIndex = fromTable.columns.findIndex((c) => c.name === rel.fromColumn);
      const toColumnIndex = toTable.columns.findIndex((c) => c.name === rel.toColumn);

      const fromX = fromTable.x + fromTable.width;
      const fromY = fromTable.y + TABLE_HEADER_HEIGHT + (fromColumnIndex * COLUMN_HEIGHT) + COLUMN_HEIGHT / 2;
      const toX = toTable.x;
      const toY = toTable.y + TABLE_HEADER_HEIGHT + (toColumnIndex * COLUMN_HEIGHT) + COLUMN_HEIGHT / 2;

      // Orthogonal routing with 90-degree bends and rounded corners
      const cornerRadius = 8;
      const offset = 40; // Distance to move away from tables before turning
      
      // Determine routing: horizontal first or vertical first based on distance
      const dx = toX - fromX;
      const dy = toY - fromY;
      const horizontalFirst = Math.abs(dx) > Math.abs(dy);
      
      let pathPoints: { x: number; y: number }[] = [];
      
      if (horizontalFirst) {
        // Horizontal first: fromX -> (fromX + offset) -> (fromX + offset, toY) -> toX
        const midX = fromX + offset;
        const turnY = toY;
        pathPoints = [
          { x: fromX, y: fromY },
          { x: midX, y: fromY },
          { x: midX, y: turnY },
          { x: toX, y: turnY },
          { x: toX, y: toY },
        ];
      } else {
        // Vertical first: fromX -> fromY -> (toX, fromY + offset) -> toX
        const turnX = toX;
        const midY = fromY + (dy > 0 ? offset : -offset);
        pathPoints = [
          { x: fromX, y: fromY },
          { x: fromX, y: midY },
          { x: turnX, y: midY },
          { x: turnX, y: toY },
          { x: toX, y: toY },
        ];
      }

      // Draw orthogonal path with rounded corners
      ctx.strokeStyle = selectedTable === rel.from || selectedTable === rel.to
        ? "hsl(221, 83%, 53%)"
        : "hsl(221, 83%, 45%)";
      ctx.lineWidth = selectedTable === rel.from || selectedTable === rel.to ? 2.5 : 1.5;
      ctx.setLineDash([]);
      
      ctx.beginPath();
      ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
      
      // Draw path with rounded corners using arcTo
      for (let i = 1; i < pathPoints.length; i++) {
        const prev = pathPoints[i - 1];
        const curr = pathPoints[i];
        const next = pathPoints[i + 1];
        
        if (next) {
          // Calculate direction vectors
          const dir1x = curr.x - prev.x;
          const dir1y = curr.y - prev.y;
          const dir2x = next.x - curr.x;
          const dir2y = next.y - curr.y;
          
          // Normalize and calculate corner points
          const len1 = Math.sqrt(dir1x * dir1x + dir1y * dir1y);
          const len2 = Math.sqrt(dir2x * dir2x + dir2y * dir2y);
          
          if (len1 > 0 && len2 > 0) {
            const norm1x = dir1x / len1;
            const norm1y = dir1y / len1;
            const norm2x = dir2x / len2;
            const norm2y = dir2y / len2;
            
            // Point before corner
            const beforeCornerX = curr.x - norm1x * cornerRadius;
            const beforeCornerY = curr.y - norm1y * cornerRadius;
            
            // Point after corner
            const afterCornerX = curr.x + norm2x * cornerRadius;
            const afterCornerY = curr.y + norm2y * cornerRadius;
            
            // Draw line to before corner, then arc
            ctx.lineTo(beforeCornerX, beforeCornerY);
            ctx.arcTo(curr.x, curr.y, afterCornerX, afterCornerY, cornerRadius);
          } else {
            ctx.lineTo(curr.x, curr.y);
          }
        } else {
          // Last segment - draw to final point
          ctx.lineTo(curr.x, curr.y);
        }
      }
      ctx.stroke();

      // Calculate midpoint for label (on the middle segment)
      const midSegmentIndex = Math.floor(pathPoints.length / 2);
      const labelX = pathPoints[midSegmentIndex].x;
      const labelY = pathPoints[midSegmentIndex].y;

      // Draw relationship label background
      const labelText = rel.constraintName || rel.relationshipType || `${rel.fromColumn} → ${rel.toColumn}`;
      // Truncate label if too long
      let displayLabel = labelText;
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      let labelMetrics = ctx.measureText(displayLabel);
      const maxLabelWidth = 120;
      if (labelMetrics.width > maxLabelWidth) {
        while (ctx.measureText(displayLabel + "...").width > maxLabelWidth && displayLabel.length > 0) {
          displayLabel = displayLabel.slice(0, -1);
        }
        displayLabel += "...";
        labelMetrics = ctx.measureText(displayLabel);
      }
      const labelPadding = 6;
      const labelWidth = labelMetrics.width + labelPadding * 2;
      const labelHeight = 18;
      
      ctx.fillStyle = "hsl(240, 10%, 8%)";
      ctx.strokeStyle = selectedTable === rel.from || selectedTable === rel.to
        ? "hsl(221, 83%, 53%)"
        : "hsl(221, 83%, 40%)";
      ctx.lineWidth = 1;
      ctx.fillRect(labelX - labelWidth / 2, labelY - labelHeight / 2, labelWidth, labelHeight);
      ctx.strokeRect(labelX - labelWidth / 2, labelY - labelHeight / 2, labelWidth, labelHeight);
      
      // Draw label text
      ctx.fillStyle = selectedTable === rel.from || selectedTable === rel.to
        ? "hsl(221, 83%, 70%)"
        : "hsl(221, 83%, 55%)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(displayLabel, labelX, labelY);

      // Draw arrow at the end (pointing to the target table)
      const lastPoint = pathPoints[pathPoints.length - 1];
      const secondLastPoint = pathPoints[pathPoints.length - 2];
      const arrowAngle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
      const arrowLength = 10;
      const arrowSpread = Math.PI / 6;

      ctx.strokeStyle = selectedTable === rel.from || selectedTable === rel.to
        ? "hsl(221, 83%, 53%)"
        : "hsl(221, 83%, 45%)";
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(
        toX - arrowLength * Math.cos(arrowAngle - arrowSpread),
        toY - arrowLength * Math.sin(arrowAngle - arrowSpread)
      );
      ctx.moveTo(toX, toY);
      ctx.lineTo(
        toX - arrowLength * Math.cos(arrowAngle + arrowSpread),
        toY - arrowLength * Math.sin(arrowAngle + arrowSpread)
      );
      ctx.stroke();
      
      // Reset text alignment
      ctx.textAlign = "left";
    });

    // Draw tables (nodes) - sort by zIndex (higher = on top), then by drag/selection state
    const sortedTables = [...tables].sort((a, b) => {
      // First sort by zIndex (if exists)
      const aZ = a.zIndex ?? 0;
      const bZ = b.zIndex ?? 0;
      if (aZ !== bZ) return aZ - bZ;
      
      // Then prioritize dragged table
      if (a.id === dragTable) return 1;
      if (b.id === dragTable) return -1;
      
      // Then prioritize selected table
      if (a.id === selectedTable) return 1;
      if (b.id === selectedTable) return -1;
      
      return 0;
    });
    
    sortedTables.forEach((table) => {
      const isSelected = selectedTable === table.id;
      const isDragging = dragTable === table.id;

      // Draw table box with crisp borders
      ctx.fillStyle = isDragging 
        ? "hsl(240, 10%, 10%)" 
        : isSelected 
        ? "hsl(240, 10%, 8%)" 
        : "hsl(240, 10%, 6%)";
      ctx.strokeStyle = isDragging || isSelected
        ? "hsl(221, 83%, 53%)"
        : "hsl(240, 3.7%, 25%)";
      ctx.lineWidth = isDragging ? 2.5 : isSelected ? 2 : 1.5;

      // Draw rounded corners for table (subtle)
      const radius = 4;
      ctx.beginPath();
      ctx.moveTo(table.x + radius, table.y);
      ctx.lineTo(table.x + table.width - radius, table.y);
      ctx.quadraticCurveTo(table.x + table.width, table.y, table.x + table.width, table.y + radius);
      ctx.lineTo(table.x + table.width, table.y + table.height - radius);
      ctx.quadraticCurveTo(table.x + table.width, table.y + table.height, table.x + table.width - radius, table.y + table.height);
      ctx.lineTo(table.x + radius, table.y + table.height);
      ctx.quadraticCurveTo(table.x, table.y + table.height, table.x, table.y + table.height - radius);
      ctx.lineTo(table.x, table.y + radius);
      ctx.quadraticCurveTo(table.x, table.y, table.x + radius, table.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw header with crisp styling
      ctx.fillStyle = isSelected
        ? "hsl(221, 83%, 53%)"
        : "hsl(240, 3.7%, 22%)";
      ctx.beginPath();
      ctx.moveTo(table.x + radius, table.y);
      ctx.lineTo(table.x + table.width - radius, table.y);
      ctx.quadraticCurveTo(table.x + table.width, table.y, table.x + table.width, table.y + radius);
      ctx.lineTo(table.x + table.width, table.y + TABLE_HEADER_HEIGHT);
      ctx.lineTo(table.x, table.y + TABLE_HEADER_HEIGHT);
      ctx.lineTo(table.x, table.y + radius);
      ctx.quadraticCurveTo(table.x, table.y, table.x + radius, table.y);
      ctx.closePath();
      ctx.fill();
      
      // Header border
      ctx.strokeStyle = isSelected
        ? "hsl(221, 83%, 53%)"
        : "hsl(240, 3.7%, 30%)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw table name in header with crisp font
      ctx.fillStyle = isSelected
        ? "hsl(0, 0%, 100%)"
        : "hsl(0, 0%, 98%)";
      ctx.font = "600 13px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      // Truncate table name if too long
      let tableNameText = table.name;
      const nameMetrics = ctx.measureText(tableNameText);
      if (nameMetrics.width > table.width - 20) {
        while (ctx.measureText(tableNameText + "...").width > table.width - 20 && tableNameText.length > 0) {
          tableNameText = tableNameText.slice(0, -1);
        }
        tableNameText += "...";
      }
      ctx.fillText(
        tableNameText,
        table.x + 10,
        table.y + TABLE_HEADER_HEIGHT / 2
      );

      // Draw columns with proper text overflow handling
      ctx.textAlign = "left";
      const columnNameMaxWidth = table.width * 0.45; // 45% for column name
      const columnTypeMaxWidth = table.width * 0.35; // 35% for type
      const iconAreaWidth = 40; // Space for PK/FK icons
      
      table.columns.forEach((column, idx) => {
        const y = table.y + TABLE_HEADER_HEIGHT + (idx * COLUMN_HEIGHT) + COLUMN_HEIGHT / 2;
        const columnNameX = table.x + 10;
        const columnTypeX = table.x + columnNameMaxWidth + 5;
        const iconX = table.x + table.width - iconAreaWidth;

        // Column name with truncation
        ctx.fillStyle = "hsl(0, 0%, 98%)";
        ctx.font = "11px system-ui, -apple-system, sans-serif";
        let columnNameText = column.name;
        const nameMetrics = ctx.measureText(columnNameText);
        if (nameMetrics.width > columnNameMaxWidth - 5) {
          // Truncate with ellipsis
          while (ctx.measureText(columnNameText + "...").width > columnNameMaxWidth - 5 && columnNameText.length > 0) {
            columnNameText = columnNameText.slice(0, -1);
          }
          columnNameText += "...";
        }
        ctx.fillText(columnNameText, columnNameX, y);

        // Column type with truncation and smaller font if needed
        ctx.fillStyle = "hsl(240, 5%, 65%)";
        let typeText = column.type;
        let typeFontSize = 10;
        ctx.font = `${typeFontSize}px system-ui, -apple-system, sans-serif`;
        let typeMetrics = ctx.measureText(typeText);
        
        // If type is too long, try smaller font first
        if (typeMetrics.width > columnTypeMaxWidth - 5) {
          typeFontSize = 9;
          ctx.font = `${typeFontSize}px system-ui, -apple-system, sans-serif`;
          typeMetrics = ctx.measureText(typeText);
        }
        
        // If still too long, truncate
        if (typeMetrics.width > columnTypeMaxWidth - 5) {
          while (ctx.measureText(typeText + "...").width > columnTypeMaxWidth - 5 && typeText.length > 0) {
            typeText = typeText.slice(0, -1);
          }
          typeText += "...";
        }
        ctx.fillText(typeText, columnTypeX, y);

        // Primary key icon
        if (column.isPrimaryKey) {
          ctx.fillStyle = "hsl(45, 93%, 58%)";
          ctx.font = "9px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "right";
          ctx.fillText("PK", iconX, y);
          ctx.textAlign = "left";
        }

        // Foreign key icon
        if (column.isForeignKey) {
          ctx.fillStyle = "hsl(221, 83%, 53%)";
          ctx.font = "9px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "right";
          const fkX = column.isPrimaryKey ? iconX - 25 : iconX;
          ctx.fillText("FK", fkX, y);
          ctx.textAlign = "left";
        }
      });
    });

    ctx.restore();
  }, [tables, relationships, selectedTable, zoom, pan, dragTable]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      
      // Set actual size in memory (scaled for device pixel ratio)
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // Scale the canvas back down using CSS
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      // Scale the drawing context so everything draws at the correct size
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      
      draw();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isLocked) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const clickedTable = tables.find(
      (table) =>
        x >= table.x &&
        x <= table.x + table.width &&
        y >= table.y &&
        y <= table.y + table.height
    );

    if (clickedTable) {
      setIsDragging(true);
      setDragTable(clickedTable.id);
      setDragOffset({
        x: x - clickedTable.x,
        y: y - clickedTable.y,
      });
      setSelectedTable(clickedTable.id);
      
      // Bring clicked table to front by increasing zIndex
      const maxZIndex = Math.max(...tables.map(t => t.zIndex || 0), 0);
      setTables((prev) =>
        prev.map((t) =>
          t.id === clickedTable.id
            ? { ...t, zIndex: (t.zIndex || 0) + 1 }
            : t
        )
      );
    } else {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanInitial(pan);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    if (isDragging && dragTable && !isLocked) {
      const table = tables.find((t) => t.id === dragTable);
      if (table) {
        setTables((prev) =>
          prev.map((t) =>
            t.id === dragTable
              ? { ...t, x: x - dragOffset.x, y: y - dragOffset.y }
              : t
          )
        );
      }
    } else if (isPanning) {
      setPan({
        x: panInitial.x + (e.clientX - panStart.x),
        y: panInitial.y + (e.clientY - panStart.y),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsPanning(false);
    setDragTable(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const clickedTable = tables.find(
      (table) =>
        x >= table.x &&
        x <= table.x + table.width &&
        y >= table.y &&
        y <= table.y + table.height
    );

    if (clickedTable && onTableSelect) {
      onTableSelect(clickedTable.schema, clickedTable.name);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.3, Math.min(2, prev * delta)));
  };

  const exportPNG = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL("image/png");
    const filename = `schema-${currentSchema || "default"}-${Date.now()}.png`;

    // Check if we're in Electron
    if (typeof window !== "undefined" && (window as any).electronAPI?.saveFile) {
      try {
        const result = await (window as any).electronAPI.saveFile(dataURL, filename);
        if (result?.canceled) {
          return; // User canceled
        }
        if (result?.error) {
          console.error("Failed to save file:", result.error);
          toast.error("Failed to save file", { description: result.error });
          return;
        }
        // Success - file saved
        if (result?.filePath) {
          toast.success("Schema exported successfully", { description: `Saved to ${result.filePath}` });
        }
        return;
      } catch (error) {
        console.error("Error saving file in Electron:", error);
        // Fallback to browser download
      }
    }

    // Browser fallback
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataURL;
    link.click();
  };

  const getMinimapBounds = () => {
    if (tables.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

    const minX = Math.min(...tables.map((t) => t.x));
    const minY = Math.min(...tables.map((t) => t.y));
    const maxX = Math.max(...tables.map((t) => t.x + t.width));
    const maxY = Math.max(...tables.map((t) => t.y + t.height));

    return { minX, minY, maxX, maxY };
  };

  if (!connectionId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Connect to a database to view schema
      </div>
    );
  }

  const bounds = getMinimapBounds();
  const viewportWidth = containerRef.current?.clientWidth || 1000;
  const viewportHeight = containerRef.current?.clientHeight || 1000;

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
        <div className="flex items-center gap-3">
          {/* Schema Selector */}
          {availableSchemas.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 justify-between min-w-[150px]">
                  <span>{currentSchema || "Select schema"}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Search schemas..."
                    value={schemaSearchTerm}
                    onChange={(e) => setSchemaSearchTerm(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {availableSchemas
                    .filter((schema) =>
                      !schemaSearchTerm || schema.toLowerCase().includes(schemaSearchTerm.toLowerCase())
                    )
                    .map((schema) => (
                      <button
                        key={schema}
                        onClick={() => {
                          setCurrentSchema(schema);
                          setSchemaSearchTerm("");
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                          currentSchema === schema && "bg-accent"
                        )}
                      >
                        {schema}
                      </button>
                    ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <span className="text-xs text-muted-foreground">
            {isLoading ? "Loading..." : `${tables.length} tables, ${relationships.length} relationships`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportPNG}
            className="h-8"
          >
            <Download className="h-3.5 w-3.5 mr-2" />
            Export PNG
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
        style={{ backgroundColor: "hsl(240, 10%, 4%)" }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          className="absolute inset-0 cursor-move"
        />

        {/* Controls */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-2">
          <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-2 flex flex-col gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsLocked(!isLocked)}
            >
              <Lock className={cn("h-4 w-4", isLocked && "text-primary")} />
            </Button>
          </div>
        </div>

        {/* Minimap */}
        {tables.length > 0 && (
          <div className="absolute bottom-4 right-4 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-2">
            <div className="text-xs font-medium mb-2 text-muted-foreground">Overview</div>
            <div
              className="relative border border-border rounded"
              style={{
                width: 200,
                height: 150,
                backgroundColor: "hsl(240, 3.7%, 16%)",
              }}
            >
              <svg
                width="200"
                height="150"
                className="absolute inset-0"
                style={{ overflow: "visible" }}
              >
                {tables.map((table) => {
                  const scaleX = 200 / (bounds.maxX - bounds.minX + 200);
                  const scaleY = 150 / (bounds.maxY - bounds.minY + 200);
                  const x = (table.x - bounds.minX) * scaleX;
                  const y = (table.y - bounds.minY) * scaleY;
                  const w = table.width * scaleX;
                  const h = table.height * scaleY;

                  return (
                    <rect
                      key={table.id}
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill="hsl(221, 83%, 53%, 0.3)"
                      stroke="hsl(221, 83%, 53%)"
                      strokeWidth={1}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
