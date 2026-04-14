"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SidebarContextType {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Always start with false to match server render, then update after mount
  const [collapsed, setCollapsed] = useState(false);

  // Only read from localStorage after mount to prevent hydration mismatch
  useEffect(() => {
    const stored = localStorage.getItem("relic_sidebar_collapsed");
    if (stored === "true") {
      setCollapsed(true);
    }
  }, []);

  const toggle = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem("relic_sidebar_collapsed", String(newState));
    }
  };

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
