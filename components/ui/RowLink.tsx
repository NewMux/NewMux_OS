"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext } from "react";
import { cn } from "@/lib/utils";
import { SplitListContext } from "./Page";

/** A list row's link; in a split view's list column it shows as selected while its item is open. */
export function RowLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const inList = useContext(SplitListContext);
  const target = href.split("?")[0]!;
  const selected = inList && (pathname === target || pathname.startsWith(`${target}/`));
  return (
    <Link href={href} aria-current={selected ? "page" : undefined} className={cn(className, selected && "lg:bg-fill/[0.16]")}>
      {children}
    </Link>
  );
}
