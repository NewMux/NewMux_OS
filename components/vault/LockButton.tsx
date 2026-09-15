"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiMutate } from "@/lib/api/client";
import { Lock } from "lucide-react";

export function LockButton() {
  const router = useRouter();

  async function handleLock() {
    await apiMutate("/api/vault/lock", { method: "POST" });
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleLock}>
      <Lock className="h-4 w-4" /> Lock vault
    </Button>
  );
}
