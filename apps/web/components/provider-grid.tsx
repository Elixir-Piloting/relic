"use client";

import { useRouter } from "next/navigation";
import { DatabaseProvider, getAllProviders, getProviderMetadata } from "@/lib/db/providers";
import { cn } from "@/lib/utils";

interface ProviderGridProps {
  onSelect?: (provider: DatabaseProvider) => void;
}

export function ProviderGrid({ onSelect }: ProviderGridProps) {
  const router = useRouter();
  const providers = getAllProviders();

  const handleSelect = (provider: DatabaseProvider) => {
    if (onSelect) {
      onSelect(provider);
    } else {
      router.push(`/add-connection/${provider}`);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {providers.map((provider) => (
        <button
          key={provider.id}
          onClick={() => handleSelect(provider.id)}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border border-border",
            "hover:bg-accent hover:border-accent-foreground/20 transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          )}
        >
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: provider.color + "20" }}
          >
            {provider.iconType === "image" ? (
              <img
                src={provider.icon}
                alt={provider.name}
                className="w-7 h-7 object-contain"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = "none";
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<span class="text-base font-bold" style="color: ${provider.color}">${provider.name.charAt(0)}</span>`;
                  }
                }}
              />
            ) : (
              <span className="text-xl">{provider.icon}</span>
            )}
          </div>
          <p className="font-medium truncate">{provider.name}</p>
        </button>
      ))}
    </div>
  );
}