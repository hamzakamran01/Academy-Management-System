import { Skeleton, ListSkeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="pt-4 lg:pt-0">
      <Skeleton className="mb-2 h-7 w-48" />
      <Skeleton className="mb-6 h-4 w-32" />
      <ListSkeleton rows={5} />
    </div>
  );
}
