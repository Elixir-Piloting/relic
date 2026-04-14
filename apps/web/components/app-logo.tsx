"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  className?: string;
}

export function AppLogo({ className }: AppLogoProps) {
  return (
    <div
      className={cn(
        "relative w-full h-full rounded-lg overflow-hidden",
        "aspect-square",
        "border-2 border-[#1e85ba]/20",
        "before:absolute before:inset-0 before:rounded-lg",
        "before:border before:border-[#4e5a6a]/15",
        "before:pointer-events-none",
        "shadow-sm",
        className
      )}
      style={{
        background: `
          linear-gradient(135deg, 
            rgba(223, 255, 254, 0.15) 0%, 
            rgba(30, 133, 186, 0.2) 30%, 
            rgba(78, 90, 106, 0.25) 60%, 
            rgba(12, 16, 24, 0.3) 100%
          ),
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 2px,
            rgba(30, 133, 186, 0.03) 2px,
            rgba(30, 133, 186, 0.03) 4px
          )
        `,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full p-2">
          <Image
            src="/applogo.png"
            alt="Relic Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>
    </div>
  );
}
