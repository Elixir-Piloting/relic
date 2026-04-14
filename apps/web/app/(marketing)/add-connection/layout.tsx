"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/app-logo";
import { Breadcrumbs } from "@/components/breadcrumbs";

interface AddConnectionLayoutProps {
  children: React.ReactNode;
}

export default function AddConnectionLayout({ children }: AddConnectionLayoutProps) {
  const router = useRouter();

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-muted/20">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <AppLogo className="h-5 w-5" />
          <span className="font-medium">Relic</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}