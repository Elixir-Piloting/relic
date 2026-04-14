import type { DatabaseProvider } from "@/lib/db/providers";
import type { ColumnInfo } from "@/lib/db/types";

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: Array<{ name: string; dataTypeID: number }>;
}

export interface ResultsViewerProps {
  result: QueryResult | null;
  error: string | null;
  loading?: boolean;
  schema?: string;
  table?: string;
  columns?: ColumnInfo[];
  primaryKeys?: string[];
  onRefresh?: () => void;
  enableCRUD?: boolean;
  provider?: DatabaseProvider;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  showPagination?: boolean;
}

export const ITEMS_PER_PAGE = 500;
export const PAGE_SIZE_OPTIONS = [50, 100, 250, 500, 1000];