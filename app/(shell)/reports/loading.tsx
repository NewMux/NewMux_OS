import { ListSkeleton } from "@/components/skeletons/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold text-foreground">
        Reports &amp; Export
      </h1>
      <ListSkeleton />
    </div>
  );
}
