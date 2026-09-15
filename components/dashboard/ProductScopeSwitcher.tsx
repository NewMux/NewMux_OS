"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Product } from "@/lib/data/types";

export function ProductScopeSwitcher({ products }: { products: Product[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("product") ?? "all";

  return (
    <select
      value={current}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value === "all") {
          params.delete("product");
        } else {
          params.set("product", e.target.value);
        }
        router.push(`/dashboard?${params.toString()}`);
      }}
      className="min-h-[40px] rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
    >
      <option value="all">All Products</option>
      {products.map((p) => (
        <option key={p.id} value={p.slug}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
