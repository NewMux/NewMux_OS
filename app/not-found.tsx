import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg items-center justify-center py-16">
      <Card className="w-full text-center">
        <div className="mx-auto mb-3 w-fit rounded-full bg-muted/60 p-2.5">
          <FileQuestion className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="mb-1 text-base font-semibold text-foreground">
          Not found
        </h1>
        <p className="mb-4 text-sm text-muted-foreground">
          That record may have been deleted, or the link is wrong.
        </p>
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </Card>
    </div>
  );
}
