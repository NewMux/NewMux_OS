import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonVariants } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <EmptyState
        icon={SearchX}
        title="Not found"
        message="It may have been deleted, or the link is wrong."
        action={
          <Link href="/home" className={buttonVariants()}>
            Go Home
          </Link>
        }
      />
    </div>
  );
}
