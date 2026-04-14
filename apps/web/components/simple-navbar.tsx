"use client";

import { Button } from "@/components/ui/button";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useSidebar } from "@/components/sidebar-context";

export function SimpleNavbar() {
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebar();

  return (
    <div className="h-12 border-b border-border bg-muted/20 flex items-center px-4 gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="h-8 w-8"
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? (
          <PanelLeft className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
