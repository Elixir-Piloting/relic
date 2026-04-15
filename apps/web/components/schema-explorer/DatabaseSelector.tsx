"use client";

import { useState, useMemo } from "react";
import { ChevronDown, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatabaseSelectorProps {
  databases: string[];
  selectedDatabase: string | null;
  onDatabaseSelect: (database: string) => void;
}

export function DatabaseSelector({
  databases,
  selectedDatabase,
  onDatabaseSelect,
}: DatabaseSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredDatabases = useMemo(() => {
    const sorted = [...databases].sort((a, b) => {
      if (a === "public") return -1;
      if (b === "public") return 1;
      return a.localeCompare(b);
    });

    if (!searchTerm || searchTerm.trim() === "") return sorted;

    const searchLower = searchTerm.toLowerCase();
    return sorted.filter((db) => db.toLowerCase().includes(searchLower));
  }, [databases, searchTerm]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between h-8 text-sm">
          <div className="flex items-center gap-2">
            <Database className="h-3 w-3" />
            <span>{selectedDatabase || "Select database"}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Search databases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {filteredDatabases.map((db) => (
            <button
              key={db}
              onClick={() => {
                onDatabaseSelect(db);
                setSearchTerm("");
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2",
                selectedDatabase === db && "bg-accent"
              )}
            >
              <Database className="h-3 w-3 opacity-50" />
              {db}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}