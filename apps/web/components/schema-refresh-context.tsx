"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface SchemaRefreshContextType {
  triggerRefresh: () => void;
  refreshKey: number;
}

const SchemaRefreshContext = createContext<SchemaRefreshContextType | null>(null);

export function SchemaRefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  
  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);
  
  return (
    <SchemaRefreshContext.Provider value={{ triggerRefresh, refreshKey }}>
      {children}
    </SchemaRefreshContext.Provider>
  );
}

export function useSchemaRefresh() {
  const context = useContext(SchemaRefreshContext);
  if (!context) {
    return { triggerRefresh: () => {}, refreshKey: 0 };
  }
  return context;
}
