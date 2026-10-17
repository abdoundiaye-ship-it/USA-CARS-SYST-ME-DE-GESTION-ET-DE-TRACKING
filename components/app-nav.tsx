"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: Route;
  label: string;
}

/** Navigation principale : liste horizontale défilante sur mobile, colonne sur grand écran. */
export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="overflow-x-auto">
      <ul className="flex gap-1 md:flex-col">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm whitespace-nowrap",
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-background",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
