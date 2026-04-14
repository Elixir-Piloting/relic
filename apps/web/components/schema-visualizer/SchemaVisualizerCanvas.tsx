"use client";

import { useEffect, useCallback, useRef } from "react";
import { useTheme } from "next-themes";
import { TableNode, RelationshipEdge, ColumnInfo, TABLE_HEADER_HEIGHT, COLUMN_HEIGHT } from "./constants";
import { cn } from "@/lib/utils";

function getThemeColors(isDark: boolean) {
  return {
    background: isDark ? "hsl(240, 6%, 5%)" : "hsl(0, 0%, 98%)",
    surface: isDark ? "hsl(240, 6%, 8%)" : "hsl(0, 0%, 100%)",
    surfaceHover: isDark ? "hsl(240, 6%, 10%)" : "hsl(0, 0%, 96%)",
    border: isDark ? "hsl(240, 4%, 18%)" : "hsl(0, 0%, 90%)",
    text: isDark ? "hsl(0, 0%, 96%)" : "hsl(240, 6%, 10%)",
    textMuted: isDark ? "hsl(240, 5%, 55%)" : "hsl(240, 4%, 40%)",
    primary: "hsl(212, 100%, 55%)",
    primaryLight: "hsl(212, 100%, 65%)",
    primaryLighter: "hsl(212, 100%, 70%)",
    warning: "hsl(45, 93%, 58%)",
    minimapBg: isDark ? "hsl(240, 4%, 14%)" : "hsl(0, 0%, 95%)",
  };
}

interface SchemaVisualizerCanvasProps {
  tables: TableNode[];
  relationships: RelationshipEdge[];
  selectedTable: string | null;
  dragTable: string | null;
  zoom: number;
  pan: { x: number; y: number };
  isLocked: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: () => void;
  onDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void;
}

export function SchemaVisualizerCanvas({
  tables,
  relationships,
  selectedTable,
  dragTable,
  zoom,
  pan,
  isLocked,
  canvasRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onDoubleClick,
  onWheel,
}: SchemaVisualizerCanvasProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const colors = getThemeColors(isDark);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    ctx.textBaseline = "middle";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    drawRelationships(ctx, relationships, tables, selectedTable, colors, isDark);
    drawTables(ctx, tables, selectedTable, dragTable, colors, isDark);

    ctx.restore();
  }, [tables, relationships, selectedTable, dragTable, zoom, pan, isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

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

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDoubleClick={onDoubleClick}
      onWheel={onWheel}
      className="absolute inset-0 cursor-move"
    />
  );
}

function drawRelationships(
  ctx: CanvasRenderingContext2D,
  relationships: RelationshipEdge[],
  tables: TableNode[],
  selectedTable: string | null,
  colors: ReturnType<typeof getThemeColors>,
  isDark: boolean
) {
  relationships.forEach((rel) => {
    const fromTable = tables.find((t) => t.id === rel.from);
    const toTable = tables.find((t) => t.id === rel.to);

    if (!fromTable || !toTable) return;

    const fromColumnIndex = fromTable.columns.findIndex((c) => c.name === rel.fromColumn);
    const toColumnIndex = toTable.columns.findIndex((c) => c.name === rel.toColumn);

    const fromX = fromTable.x + fromTable.width;
    const fromY = fromTable.y + TABLE_HEADER_HEIGHT + (fromColumnIndex * COLUMN_HEIGHT) + COLUMN_HEIGHT / 2;
    const toX = toTable.x;
    const toY = toTable.y + TABLE_HEADER_HEIGHT + (toColumnIndex * COLUMN_HEIGHT) + COLUMN_HEIGHT / 2;

    const cornerRadius = 8;
    const offset = 40;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const horizontalFirst = Math.abs(dx) > Math.abs(dy);

    let pathPoints: { x: number; y: number }[] = [];

    if (horizontalFirst) {
      const midX = fromX + offset;
      pathPoints = [
        { x: fromX, y: fromY },
        { x: midX, y: fromY },
        { x: midX, y: toY },
        { x: toX, y: toY },
        { x: toX, y: toY },
      ];
    } else {
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

    ctx.strokeStyle = selectedTable === rel.from || selectedTable === rel.to
      ? colors.primary
      : colors.primaryLight;
    ctx.lineWidth = selectedTable === rel.from || selectedTable === rel.to ? 2.5 : 1.5;
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) {
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }
    ctx.stroke();

    const midSegmentIndex = Math.floor(pathPoints.length / 2);
    const labelX = pathPoints[midSegmentIndex].x;
    const labelY = pathPoints[midSegmentIndex].y;

    const labelText = rel.constraintName || rel.relationshipType || `${rel.fromColumn} → ${rel.toColumn}`;
    let displayLabel = labelText;
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    let labelMetrics = ctx.measureText(displayLabel);
    const maxLabelWidth = 120;
    if (labelMetrics.width > maxLabelWidth) {
      while (ctx.measureText(displayLabel + "...").width > maxLabelWidth && displayLabel.length > 0) {
        displayLabel = displayLabel.slice(0, -1);
      }
      displayLabel += "...";
    }
    const labelPadding = 6;
    const labelWidth = labelMetrics.width + labelPadding * 2;
    const labelHeight = 18;

    ctx.fillStyle = colors.surface;
    ctx.strokeStyle = selectedTable === rel.from || selectedTable === rel.to
      ? colors.primary
      : colors.primary;
    ctx.lineWidth = 1;
    ctx.fillRect(labelX - labelWidth / 2, labelY - labelHeight / 2, labelWidth, labelHeight);
    ctx.strokeRect(labelX - labelWidth / 2, labelY - labelHeight / 2, labelWidth, labelHeight);

    ctx.fillStyle = selectedTable === rel.from || selectedTable === rel.to
      ? colors.primaryLight
      : colors.primary;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(displayLabel, labelX, labelY);

    const lastPoint = pathPoints[pathPoints.length - 1];
    const secondLastPoint = pathPoints[pathPoints.length - 2];
    const arrowAngle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
    const arrowLength = 10;
    const arrowSpread = Math.PI / 6;

    ctx.strokeStyle = selectedTable === rel.from || selectedTable === rel.to
      ? colors.primary
      : colors.primaryLight;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - arrowLength * Math.cos(arrowAngle - arrowSpread), toY - arrowLength * Math.sin(arrowAngle - arrowSpread));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - arrowLength * Math.cos(arrowAngle + arrowSpread), toY - arrowLength * Math.sin(arrowAngle + arrowSpread));
    ctx.stroke();

    ctx.textAlign = "left";
  });
}

function drawTables(
  ctx: CanvasRenderingContext2D,
  tables: TableNode[],
  selectedTable: string | null,
  dragTable: string | null,
  colors: ReturnType<typeof getThemeColors>,
  isDark: boolean
) {
  const sortedTables = [...tables].sort((a, b) => {
    const aZ = a.zIndex ?? 0;
    const bZ = b.zIndex ?? 0;
    if (aZ !== bZ) return aZ - bZ;
    if (a.id === dragTable) return 1;
    if (b.id === dragTable) return -1;
    if (a.id === selectedTable) return 1;
    if (b.id === selectedTable) return -1;
    return 0;
  });

  sortedTables.forEach((table) => {
    const isSelected = selectedTable === table.id;
    const isDragging = dragTable === table.id;

    ctx.fillStyle = isDragging
      ? colors.surfaceHover
      : isSelected
      ? colors.surface
      : colors.background;
    ctx.strokeStyle = isDragging || isSelected
      ? colors.primary
      : colors.border;
    ctx.lineWidth = isDragging ? 2.5 : isSelected ? 2 : 1.5;

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

    ctx.fillStyle = isSelected
      ? colors.primary
      : isDark ? "hsl(240, 3.7%, 22%)" : "hsl(0, 0%, 94%)";
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

    ctx.strokeStyle = isSelected
      ? colors.primary
      : isDark ? "hsl(240, 3.7%, 30%)" : "hsl(0, 0%, 88%)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isSelected
      ? "hsl(0, 0%, 100%)"
      : colors.text;
    ctx.font = "600 13px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let tableNameText = table.name;
    const nameMetrics = ctx.measureText(tableNameText);
    if (nameMetrics.width > table.width - 20) {
      while (ctx.measureText(tableNameText + "...").width > table.width - 20 && tableNameText.length > 0) {
        tableNameText = tableNameText.slice(0, -1);
      }
      tableNameText += "...";
    }
    ctx.fillText(tableNameText, table.x + 10, table.y + TABLE_HEADER_HEIGHT / 2);

    const columnNameMaxWidth = table.width * 0.45;
    const columnTypeMaxWidth = table.width * 0.35;
    const iconAreaWidth = 40;

    table.columns.forEach((column, idx) => {
      const y = table.y + TABLE_HEADER_HEIGHT + (idx * COLUMN_HEIGHT) + COLUMN_HEIGHT / 2;
      const columnNameX = table.x + 10;
      const columnTypeX = table.x + columnNameMaxWidth + 5;
      const iconX = table.x + table.width - iconAreaWidth;

      ctx.fillStyle = colors.text;
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      let columnNameText = column.name;
      const nameMetrics = ctx.measureText(columnNameText);
      if (nameMetrics.width > columnNameMaxWidth - 5) {
        while (ctx.measureText(columnNameText + "...").width > columnNameMaxWidth - 5 && columnNameText.length > 0) {
          columnNameText = columnNameText.slice(0, -1);
        }
        columnNameText += "...";
      }
      ctx.fillText(columnNameText, columnNameX, y);

      ctx.fillStyle = colors.textMuted;
      let typeText = column.type;
      let typeFontSize = 10;
      ctx.font = `${typeFontSize}px system-ui, -apple-system, sans-serif`;
      let typeMetrics = ctx.measureText(typeText);

      if (typeMetrics.width > columnTypeMaxWidth - 5) {
        typeFontSize = 9;
        ctx.font = `${typeFontSize}px system-ui, -apple-system, sans-serif`;
        typeMetrics = ctx.measureText(typeText);
      }

      if (typeMetrics.width > columnTypeMaxWidth - 5) {
        while (ctx.measureText(typeText + "...").width > columnTypeMaxWidth - 5 && typeText.length > 0) {
          typeText = typeText.slice(0, -1);
        }
        typeText += "...";
      }
      ctx.fillText(typeText, columnTypeX, y);

      if (column.isPrimaryKey) {
        ctx.fillStyle = colors.warning;
        ctx.font = "9px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("PK", iconX, y);
        ctx.textAlign = "left";
      }

      if (column.isForeignKey) {
        ctx.fillStyle = colors.primary;
        ctx.font = "9px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "right";
        const fkX = column.isPrimaryKey ? iconX - 25 : iconX;
        ctx.fillText("FK", fkX, y);
        ctx.textAlign = "left";
      }
    });
  });
}