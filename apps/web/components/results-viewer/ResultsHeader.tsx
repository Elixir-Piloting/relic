"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ITEMS_PER_PAGE, PAGE_SIZE_OPTIONS } from "./types";

interface ResultsHeaderProps {
  rowCount: number;
  page: number;
  pageSize: number;
  isMongoDB: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function ResultsHeader({
  rowCount,
  page,
  pageSize,
  isMongoDB,
  onPageChange,
  onPageSizeChange,
}: ResultsHeaderProps) {
  const totalPages = Math.ceil(rowCount / pageSize);

  return (
    <div className="flex items-center justify-between px-4 py-3 border border-border bg-muted/30 rounded-t-lg">
      <div className="flex items-center gap-4">
        <div className="text-sm text-muted-foreground">
          {rowCount.toLocaleString()} {isMongoDB ? "document" : "row"}
          {rowCount !== 1 ? "s" : ""}
          {totalPages > 1 && ` • Page ${page} of ${totalPages}`}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <span className="h-4 w-4">←</span>
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <span className="h-4 w-4">→</span>
          </Button>
        </div>
      )}
    </div>
  );
}