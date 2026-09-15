import { BoardSkeleton } from "@/components/skeletons/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-xl font-semibold text-foreground">
        Outbound Outreach &amp; Deal Pipeline
      </h1>
      <BoardSkeleton />
    </div>
  );
}
