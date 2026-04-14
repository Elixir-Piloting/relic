"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

function useBreadcrumbs(items?: BreadcrumbItem[]): BreadcrumbItem[] {
  const pathname = usePathname();

  if (items && items.length > 0) {
    return items;
  }

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];

  if (segments.length === 0) {
    return [{ label: "Home", href: "/" }];
  }

  let path = "";
  for (const segment of segments) {
    path += `/${segment}`;
    const label = segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    
    crumbs.push({
      label,
      href: crumbs.length === segments.length - 1 ? undefined : path,
    });
  }

  return crumbs;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const breadcrumbs = useBreadcrumbs(items);

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className={cn("flex items-center gap-1 text-sm", className)}>
      {breadcrumbs.map((crumb, index) => (
        <div key={index} className="flex items-center gap-1">
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          )}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{crumb.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}

export function AppHeader({
  title,
  breadcrumbs,
  children,
}: {
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
  children?: React.ReactNode;
}) {
  const crumbs = breadcrumbs || (title ? [{ label: title }] : []);

  return (
    <div className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-muted/20">
      <Breadcrumbs items={crumbs} />
      {children}
    </div>
  );
}
