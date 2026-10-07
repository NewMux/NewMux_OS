import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonVariants } from "@/components/ui/Button";

/** Any unknown URL outside the signed-in app (the shell has its own). */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-5">
      <EmptyState
        icon={SearchX}
        title="Page not found"
        message="It may have been moved, or the link is wrong."
        action={
          <Link href="/home" className={buttonVariants()}>
            Go to Today
          </Link>
        }
      />
    </div>
  );
}
