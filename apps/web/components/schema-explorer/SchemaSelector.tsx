"use client";

import { useState, useMemo } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SchemaSelectorProps {
  schemas: string[];
  selectedSchema: string | null;
  onSchemaSelect: (schema: string) => void;
  onCreateSchema?: () => void;
}

export function SchemaSelector({
  schemas,
  selectedSchema,
  onSchemaSelect,
  onCreateSchema,
}: SchemaSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSchemas = useMemo(() => {
    const sorted = [...schemas].sort((a, b) => {
      if (a === "public") return -1;
      if (b === "public") return 1;
      return a.localeCompare(b);
    });

    if (!searchTerm || searchTerm.trim() === "") return sorted;

    const searchLower = searchTerm.toLowerCase();
    return sorted.filter((s) => s.toLowerCase().includes(searchLower));
  }, [schemas, searchTerm]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between h-8 text-sm">
          <span>{selectedSchema || "Select schema"}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Search schemas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {filteredSchemas.map((schema) => (
            <button
              key={schema}
              onClick={() => {
                onSchemaSelect(schema);
                setSearchTerm("");
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                selectedSchema === schema && "bg-accent"
              )}
            >
              {schema}
            </button>
          ))}
          {onCreateSchema && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 text-sm"
                onClick={onCreateSchema}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Schema
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}