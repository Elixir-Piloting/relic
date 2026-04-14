"use client";

import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { LocalPostgresServer } from "./types";

interface ServerListProps {
  servers: LocalPostgresServer[];
  onServerExpand: (server: LocalPostgresServer) => void;
  onServerConnect: (server: LocalPostgresServer) => void;
  onDatabaseConnect: (server: LocalPostgresServer, database: string, user?: string, password?: string) => void;
  onPasswordRequired: (server: LocalPostgresServer) => void;
  isDetecting?: boolean;
  onRefresh?: () => void;
}

export function ServerList({
  servers,
  onServerExpand,
  onServerConnect,
  onDatabaseConnect,
  onPasswordRequired,
  isDetecting,
  onRefresh,
}: ServerListProps) {
  if (servers.length === 0 && !isDetecting) {
    return (
      <Alert>
        <AlertDescription>
          No local PostgreSQL servers detected. Make sure PostgreSQL is running and accessible.
        </AlertDescription>
      </Alert>
    );
  }

  if (isDetecting && servers.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Detecting servers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {servers.map((server) => (
        <div key={`${server.host}:${server.port}`} className="border rounded-lg overflow-hidden">
          <div
            className={cn(
              "flex items-center justify-between p-3 bg-muted/30 cursor-pointer",
              "hover:bg-muted/50 transition-colors"
            )}
            onClick={() => onServerExpand(server)}
          >
            <div className="flex items-center gap-2">
              {server.expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <div>
                <div className="font-medium text-sm">
                  {server.host}:{server.port}
                </div>
                {server.version && (
                  <div className="text-xs text-muted-foreground">
                    {server.version}
                  </div>
                )}
              </div>
            </div>
            {server.accessible ? (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onServerConnect(server);
                }}
              >
                Connect
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onPasswordRequired(server);
                }}
              >
                Enter Password
              </Button>
            )}
          </div>

          {server.expanded && (
            <div className="border-t p-2 bg-background">
              {server.loadingDatabases ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : server.databases && server.databases.length > 0 ? (
                <div className="space-y-1">
                  {server.databases.map((db) => (
                    <button
                      key={db}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors"
                      onClick={() => onDatabaseConnect(server, db)}
                    >
                      {db}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-2 text-center">
                  {server.accessible ? "No user databases" : "Enter password to view databases"}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}