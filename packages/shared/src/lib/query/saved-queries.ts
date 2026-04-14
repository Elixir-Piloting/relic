/**
 * Saved queries data model and persistence
 */

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  description?: string;
  tags: string[];
  connectionId: string;
  tables?: string[]; // Associated tables
  createdAt: number;
  updatedAt: number;
  version: number;
  history?: QueryVersion[]; // Version history
}

export interface QueryVersion {
  query: string;
  timestamp: number;
}

const STORAGE_PREFIX = "relic_saved_query_";

export const SavedQueries = {
  /**
   * Get all saved queries for a connection
   */
  getAll(connectionId: string): SavedQuery[] {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}all_${connectionId}`);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  /**
   * Get a saved query by ID
   */
  get(id: string, connectionId: string): SavedQuery | null {
    const all = this.getAll(connectionId);
    return all.find((q) => q.id === id) || null;
  },

  /**
   * Save a query
   */
  save(query: SavedQuery): void {
    if (typeof window === "undefined") return;
    const all = this.getAll(query.connectionId);
    const existingIndex = all.findIndex((q) => q.id === query.id);

    if (existingIndex >= 0) {
      // Update existing
      const existing = all[existingIndex];
      // Add to history if query changed
      if (existing.query !== query.query) {
        const history = existing.history || [];
        history.push({
          query: existing.query,
          timestamp: existing.updatedAt,
        });
        // Keep only last 10 versions
        query.history = history.slice(-10);
        query.version = existing.version + 1;
      } else {
        query.history = existing.history;
        query.version = existing.version;
      }
      query.createdAt = existing.createdAt;
      all[existingIndex] = query;
    } else {
      // New query
      query.version = 1;
      all.push(query);
    }

    query.updatedAt = Date.now();
    localStorage.setItem(`${STORAGE_PREFIX}all_${query.connectionId}`, JSON.stringify(all));
  },

  /**
   * Delete a saved query
   */
  delete(id: string, connectionId: string): void {
    if (typeof window === "undefined") return;
    const all = this.getAll(connectionId);
    const filtered = all.filter((q) => q.id !== id);
    localStorage.setItem(`${STORAGE_PREFIX}all_${connectionId}`, JSON.stringify(filtered));
  },

  /**
   * Search saved queries
   */
  search(connectionId: string, searchTerm: string, tags?: string[]): SavedQuery[] {
    const all = this.getAll(connectionId);
    let filtered = all;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (q) =>
          q.name.toLowerCase().includes(term) ||
          q.query.toLowerCase().includes(term) ||
          q.description?.toLowerCase().includes(term)
      );
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      filtered = filtered.filter((q) => tags.some((tag) => q.tags.includes(tag)));
    }

    return filtered;
  },

  /**
   * Get all unique tags for a connection
   */
  getTags(connectionId: string): string[] {
    const all = this.getAll(connectionId);
    const tagSet = new Set<string>();
    all.forEach((q) => {
      q.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  },
};
