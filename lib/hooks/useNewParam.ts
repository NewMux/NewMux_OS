"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Opens a "new item" sheet when the URL has ?new=1 (Home quick actions), then cleans the URL. */
export function useNewParam(open: () => void) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (params.get("new") === "1") {
      open();
      const next = new URLSearchParams(params.toString());
      next.delete("new");
      router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
}
