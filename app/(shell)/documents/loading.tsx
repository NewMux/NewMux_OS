import { ListSkeleton } from "@/components/skeletons/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-xl font-semibold text-foreground">Documents</h1>
      <ListSkeleton />
    </div>
  );
}
