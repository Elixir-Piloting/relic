import { useMutation } from "@tanstack/react-query";
import type { ConnectionConfig } from "@/lib/db/types";

interface ConnectVariables {
  config: ConnectionConfig;
}

export function useConnect() {
  return useMutation({
    mutationFn: async ({ config }: ConnectVariables) => {
      const response = await fetch("/api/db/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Connection failed");
      }
      return data;
    },
  });
}
