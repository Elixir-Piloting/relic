/**
 * Persistence utilities for storing app state
 */

const STORAGE_PREFIX = "relic_";

export const Persistence = {
  /**
   * Get active connection ID
   */
  getActiveConnectionId(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(`${STORAGE_PREFIX}active_connection`);
  },

  /**
   * Set active connection ID
   */
  setActiveConnectionId(connectionId: string | null): void {
    if (typeof window === "undefined") return;
    if (connectionId) {
      localStorage.setItem(`${STORAGE_PREFIX}active_connection`, connectionId);
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}active_connection`);
    }
  },

  /**
   * Get active view for a connection (query, tables, visualizer)
   */
  getActiveView(connectionId: string): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(`${STORAGE_PREFIX}view_${connectionId}`);
  },

  /**
   * Set active view for a connection
   */
  setActiveView(connectionId: string, view: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(`${STORAGE_PREFIX}view_${connectionId}`, view);
  },

  /**
   * Get open table tabs for a connection
   */
  getTableTabs(connectionId: string): Array<{ id: string; schema: string; table: string; label: string }> {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}tabs_${connectionId}`);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  /**
   * Save open table tabs for a connection
   */
  setTableTabs(connectionId: string, tabs: Array<{ id: string; schema: string; table: string; label: string }>): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(`${STORAGE_PREFIX}tabs_${connectionId}`, JSON.stringify(tabs));
  },

  /**
   * Get active tab ID for a connection
   */
  getActiveTabId(connectionId: string): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(`${STORAGE_PREFIX}active_tab_${connectionId}`);
  },

  /**
   * Set active tab ID for a connection
   */
  setActiveTabId(connectionId: string, tabId: string | null): void {
    if (typeof window === "undefined") return;
    if (tabId) {
      localStorage.setItem(`${STORAGE_PREFIX}active_tab_${connectionId}`, tabId);
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}active_tab_${connectionId}`);
    }
  },

  /**
   * Save expanded schemas for a connection
   */
  setExpandedSchemas(connectionId: string, schemas: string[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(`${STORAGE_PREFIX}expanded_schemas_${connectionId}`, JSON.stringify(schemas));
  },

  /**
   * Get expanded schemas for a connection
   */
  getExpandedSchemas(connectionId: string): string[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(`${STORAGE_PREFIX}expanded_schemas_${connectionId}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return ["public"]; // Default to public if parse fails
      }
    }
    return ["public"]; // Default to public schema
  },

  /**
   * Save connection form draft data
   */
  setConnectionFormDraft(data: any): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(`${STORAGE_PREFIX}connection_form_draft`, JSON.stringify(data));
  },

  /**
   * Get connection form draft data
   */
  getConnectionFormDraft(): any | null {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}connection_form_draft`);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  /**
   * Clear connection form draft data
   */
  clearConnectionFormDraft(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(`${STORAGE_PREFIX}connection_form_draft`);
  },

  /**
   * Get query tabs for a connection
   */
  getQueryTabs(connectionId: string): Array<{ id: string; label: string; query: string }> {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}query_tabs_${connectionId}`);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  /**
   * Save query tabs for a connection
   */
  setQueryTabs(connectionId: string, tabs: Array<{ id: string; label: string; query: string }>): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(`${STORAGE_PREFIX}query_tabs_${connectionId}`, JSON.stringify(tabs));
  },

  /**
   * Get active query tab ID for a connection
   */
  getActiveQueryTabId(connectionId: string): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(`${STORAGE_PREFIX}active_query_tab_${connectionId}`);
  },

  /**
   * Set active query tab ID for a connection
   */
  setActiveQueryTabId(connectionId: string, tabId: string | null): void {
    if (typeof window === "undefined") return;
    if (tabId) {
      localStorage.setItem(`${STORAGE_PREFIX}active_query_tab_${connectionId}`, tabId);
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}active_query_tab_${connectionId}`);
    }
  },

  /**
   * Auto-save query content for a specific tab
   */
  setQueryTabContent(connectionId: string, tabId: string, query: string): void {
    if (typeof window === "undefined") return;
    const tabs = this.getQueryTabs(connectionId);
    const updatedTabs = tabs.map((tab) =>
      tab.id === tabId ? { ...tab, query } : tab
    );
    this.setQueryTabs(connectionId, updatedTabs);
  },

  /**
   * Get Safe Mode state for a connection
   */
  getSafeMode(connectionId: string): boolean {
    if (typeof window === "undefined") return true; // Default to ON
    const stored = localStorage.getItem(`${STORAGE_PREFIX}safe_mode_${connectionId}`);
    if (stored === null) return true; // Default to ON
    return stored === "true";
  },

  /**
   * Set Safe Mode state for a connection
   */
  setSafeMode(connectionId: string, enabled: boolean): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(`${STORAGE_PREFIX}safe_mode_${connectionId}`, String(enabled));
  },
};

