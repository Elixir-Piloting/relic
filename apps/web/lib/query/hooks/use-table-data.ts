import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../keys";
import type { ConnectionConfig, QueryResult, ColumnInfo, IndexInfo, ConstraintInfo } from "@/lib/db/types";
import { DatabaseProvider } from "@/lib/db/providers";

interface TableDataResponse {
  result: QueryResult;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
}

async function fetchTableData(
  connectionId: string,
  schema: string,
  table: string,
  page: number,
  pageSize: number,
  provider?: DatabaseProvider
): Promise<TableDataResponse> {
  const offset = (page - 1) * pageSize;
  
  const isMongoDB = provider === DatabaseProvider.MONGODB;
  
  if (isMongoDB) {
    const dataRes = await fetch("/api/db/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `db.${table}.find({}).limit(${pageSize}).skip(${offset})`,
      }),
    });
    const data = await dataRes.json();
    
    if (!data.success) {
      throw new Error(data.error || "Failed to fetch table data");
    }
    
    return {
      result: data.data,
      columns: [],
      indexes: [],
      constraints: [],
    };
  }
  
  const [dataRes, columnsRes, indexesRes, constraintsRes] = await Promise.all([
    fetch("/api/db/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `SELECT * FROM "${schema}"."${table}" LIMIT ${pageSize} OFFSET ${offset}`,
      }),
    }),
    fetch("/api/db/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = $2
                ORDER BY ordinal_position`,
        params: [schema, table],
      }),
    }),
    fetch("/api/db/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `SELECT indexname, indexdef FROM pg_indexes
                WHERE schemaname = $1 AND tablename = $2
                ORDER BY indexname`,
        params: [schema, table],
      }),
    }),
    fetch("/api/db/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.table_schema = $1 AND tc.table_name = $2
                ORDER BY tc.constraint_name, kcu.ordinal_position`,
        params: [schema, table],
      }),
    }),
  ]);

  const [data, columnsData, indexesData, constraintsData] = await Promise.all([
    dataRes.json(),
    columnsRes.json(),
    indexesRes.json(),
    constraintsRes.json(),
  ]);

  if (!data.success) {
    throw new Error(data.error || "Failed to fetch table data");
  }

  const columns = columnsData.success
    ? columnsData.data.rows.map((r: any) => ({
        name: r.column_name,
        dataType: r.data_type,
        isNullable: r.is_nullable === "YES",
        defaultValue: r.column_default,
        characterMaximumLength: r.character_maximum_length,
      }))
    : [];

  const indexes = indexesData.success
    ? indexesData.data.rows.map((r: any) => {
        const isUnique = r.indexdef.includes("UNIQUE");
        const isPrimary = r.indexname.includes("_pkey");
        const match = r.indexdef.match(/\(([^)]+)\)/);
        const cols = match
          ? match[1].split(",").map((c: string) => c.trim().replace(/"/g, ""))
          : [];
        return { name: r.indexname, columns: cols, isUnique, isPrimary };
      })
    : [];

  const constraintsMap = new Map<string, ConstraintInfo>();
  if (constraintsData.success) {
    for (const row of constraintsData.data.rows) {
      const existing = constraintsMap.get(row.constraint_name);
      if (existing) {
        existing.columns.push(row.column_name);
      } else {
        constraintsMap.set(row.constraint_name, {
          name: row.constraint_name,
          type: row.constraint_type as ConstraintInfo["type"],
          columns: [row.column_name],
        });
      }
    }
  }

  return {
    result: data.data,
    columns,
    indexes,
    constraints: Array.from(constraintsMap.values()),
  };
}

export function useTableData(
  connectionId: string | undefined,
  schema: string | undefined,
  table: string | undefined,
  page: number,
  pageSize: number,
  provider?: DatabaseProvider
) {
  return useQuery({
    queryKey: queryKeys.db.tableData(connectionId || "", schema || "", table || "", page, pageSize),
    queryFn: async () => {
      if (!connectionId || !schema || !table) {
        throw new Error("Missing required parameters");
      }
      return fetchTableData(connectionId, schema, table, page, pageSize, provider);
    },
    enabled: !!connectionId && !!schema && !!table,
    staleTime: 1000 * 60 * 2,
  });
}

export function useRefreshTableData(connectionId: string | undefined, schema: string | undefined, table: string | undefined) {
  const queryClient = useQueryClient();
  
  return () => {
    if (connectionId && schema && table) {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.db.tableData(connectionId, schema, table, 1, 100) 
      });
    }
  };
}
