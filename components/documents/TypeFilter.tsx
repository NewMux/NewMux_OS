"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SegmentedControl } from "./SegmentedControl";
import type { DocumentType } from "@/lib/data/types";

const OPTIONS: { value: DocumentType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "quote", label: "Quotes" },
  { value: "contract", label: "Contracts" },
  { value: "invoice", label: "Invoices" },
];

export function TypeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = (searchParams.get("type") as DocumentType | null) ?? "all";

  return (
    <SegmentedControl
      options={OPTIONS}
      value={current}
      onChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all") {
          params.delete("type");
        } else {
          params.set("type", value);
        }
        router.push(`/documents?${params.toString()}`);
      }}
    />
  );
}
