"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DatabaseProvider, getAllProviders, type ProviderMetadata } from "@/lib/db/providers";
import { getSubtleBackground } from "@/lib/utils/color";

interface DatabaseProviderSelectorProps {
  value?: DatabaseProvider;
  onValueChange: (provider: DatabaseProvider) => void;
  disabled?: boolean;
}

export function DatabaseProviderSelector({
  value,
  onValueChange,
  disabled = false,
}: DatabaseProviderSelectorProps) {
  const [open, setOpen] = useState(false);
  const providers = getAllProviders();
  const selectedProvider = value ? providers.find((p) => p.id === value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select database provider"
          disabled={disabled}
          className="w-full justify-between h-10"
        >
          <div className="flex items-center gap-2">
            {selectedProvider ? (
              <>
                {selectedProvider.iconType === "image" ? (
                  <div 
                    className="relative w-5 h-5 shrink-0 rounded-sm flex items-center justify-center"
                    style={{
                      backgroundColor: getSubtleBackground(selectedProvider.color, 1.0),
                    }}
                  >
                    <img
                      src={selectedProvider.icon}
                      alt={selectedProvider.name}
                      className="w-full h-full object-contain p-0.5"
                      onError={(e) => {
                        // Hide image on error, show emoji fallback
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = `<span class="text-lg">${selectedProvider.icon}</span>`;
                        }
                      }}
                    />
                  </div>
                ) : (
                  <span className="text-lg" aria-hidden="true">
                    {selectedProvider.icon}
                  </span>
                )}
                <span className="text-sm font-medium">{selectedProvider.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Select a database</span>
            )}
          </div>
          <ChevronDown
            className="ml-2 h-4 w-4 shrink-0 opacity-50"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-1">
          <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
            Database
          </div>
          <div className="h-fit">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                role="option"
                aria-selected={value === provider.id}
                onClick={() => {
                  onValueChange(provider.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                  value === provider.id && "bg-accent text-accent-foreground"
                )}
              >
                {provider.iconType === "image" ? (
                  <div 
                    className="relative w-5 h-5 shrink-0 rounded-sm flex items-center justify-center"
                    style={{
                      backgroundColor: getSubtleBackground(provider.color, 1.0),
                    }}
                  >
                    <img
                      src={provider.icon}
                      alt={provider.name}
                      className="w-full h-full object-contain p-0.5"
                      onError={(e) => {
                        // Hide image on error, show emoji fallback
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = `<span class="text-lg">${provider.icon}</span>`;
                        }
                      }}
                    />
                  </div>
                ) : (
                  <span className="text-lg shrink-0" aria-hidden="true">
                    {provider.icon}
                  </span>
                )}
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">{provider.name}</div>
                </div>
                {value === provider.id && (
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
