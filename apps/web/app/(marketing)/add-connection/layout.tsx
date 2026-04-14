"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/app-logo";
import { DatabaseProvider, getProviderMetadata } from "@/lib/db/providers";
import { cn } from "@/lib/utils";

function getStepInfo(pathname: string): { label: string; icon: React.ReactNode } {
  const segments = pathname.split("/").filter(Boolean);
  
  // /add-connection or /add-connection/ -> New Connection
  if (segments.length <= 1) {
    return {
      label: "New Connection",
      icon: null,
    };
  }

  // segments[0] = "add-connection", segments[1] = provider or "local"
  const step = segments[1];

  if (step === "local") {
    return {
      label: "Local PostgreSQL",
      icon: (
        <div className="w-5 h-5 rounded flex items-center justify-center bg-orange-100">
          <span className="text-xs font-bold text-orange-600">P</span>
        </div>
      ),
    };
  }

  const provider = step as DatabaseProvider;
  const meta = getProviderMetadata(provider);

  return {
    label: meta.name,
    icon: (
      <div 
        className="w-5 h-5 rounded flex items-center justify-center"
        style={{ backgroundColor: meta.color + "20" }}
      >
        {meta.iconType === "image" ? (
          <img
            src={meta.icon}
            alt={meta.name}
            className="w-3.5 h-3.5 object-contain"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="text-[8px] font-bold" style="color: ${meta.color}">${meta.name.charAt(0)}</span>`;
              }
            }}
          />
        ) : (
          <span className="text-[8px] font-bold" style={{ color: meta.color }}>{meta.name.charAt(0)}</span>
        )}
      </div>
    ),
  };
}

interface AddConnectionLayoutProps {
  children: React.ReactNode;
}

export default function AddConnectionLayout({ children }: AddConnectionLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const stepInfo = getStepInfo(pathname);

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-muted/20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-sm font-medium">
            {stepInfo.icon}
            <span>{stepInfo.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AppLogo className="h-5 w-5" />
          <span className="font-medium">Relic</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto marketing-buttons marketing-inputs">
        <div className="max-w-xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}