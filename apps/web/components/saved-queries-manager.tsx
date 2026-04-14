"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bookmark, Plus, Search, Tag, MoreVertical, Play, Edit, Trash2, Copy } from "lucide-react";
import { SavedQueries, type SavedQuery } from "@/lib/query/saved-queries";
import { cn } from "@/lib/utils";

interface SavedQueriesManagerProps {
  connectionId: string;
  onRunQuery: (query: string) => void;
  className?: string;
}

export function SavedQueriesManager({
  connectionId,
  onRunQuery,
  className,
}: SavedQueriesManagerProps) {
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuery, setEditingQuery] = useState<SavedQuery | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    query: "",
    description: "",
    tags: "",
  });

  useEffect(() => {
    loadQueries();
  }, [connectionId]);

  const loadQueries = () => {
    const all = SavedQueries.getAll(connectionId);
    setQueries(all);
  };

  const filteredQueries = useMemo(() => {
    return SavedQueries.search(connectionId, searchTerm, selectedTags.length > 0 ? selectedTags : undefined);
  }, [connectionId, searchTerm, selectedTags, queries]);

  const allTags = useMemo(() => {
    return SavedQueries.getTags(connectionId);
  }, [connectionId, queries]);

  const handleSave = () => {
    if (!formData.name.trim() || !formData.query.trim()) {
      return;
    }

    const tags = formData.tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const savedQuery: SavedQuery = {
      id: editingQuery?.id || `query-${Date.now()}`,
      name: formData.name,
      query: formData.query,
      description: formData.description || undefined,
      tags,
      connectionId,
      createdAt: editingQuery?.createdAt || Date.now(),
      updatedAt: Date.now(),
      version: editingQuery?.version || 1,
    };

    SavedQueries.save(savedQuery);
    loadQueries();
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this saved query?")) {
      SavedQueries.delete(id, connectionId);
      loadQueries();
    }
  };

  const handleEdit = (query: SavedQuery) => {
    setEditingQuery(query);
    setFormData({
      name: query.name,
      query: query.query,
      description: query.description || "",
      tags: query.tags.join(", "),
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingQuery(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      query: "",
      description: "",
      tags: "",
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            Saved Queries
          </h3>
          <Button size="sm" variant="outline" onClick={handleNew}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search queries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggleTag(tag)}
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
            {selectedTags.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => setSelectedTags([])}
              >
                Clear
              </Button>
            )}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredQueries.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {searchTerm || selectedTags.length > 0
                ? "No queries found"
                : "No saved queries yet"}
            </div>
          ) : (
            filteredQueries.map((query) => (
              <div
                key={query.id}
                className="group p-2 rounded-md hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => onRunQuery(query.query)}
                        className="text-sm font-medium hover:underline text-left truncate flex-1"
                      >
                        {query.name}
                      </button>
                    </div>
                    {query.description && (
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-1">
                        {query.description}
                      </p>
                    )}
                    {query.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {query.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onRunQuery(query.query)}>
                        <Play className="h-4 w-4 mr-2" />
                        Run
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigator.clipboard.writeText(query.query)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Query
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleEdit(query)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(query.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingQuery ? "Edit Query" : "Save Query"}</DialogTitle>
            <DialogDescription>
              Save this query for quick access later
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Query"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Query *</label>
              <textarea
                value={formData.query}
                onChange={(e) => setFormData({ ...formData, query: e.target.value })}
                placeholder="SELECT * FROM ..."
                className="w-full min-h-[150px] p-2 border rounded-md bg-background font-mono text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Tags</label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.name.trim() || !formData.query.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
