import Skeleton from "./Skeleton";

export default function OpportunityCardSkeleton() {
  return (
    <div className="bg-white border border-line rounded-card p-5 flex flex-col gap-3 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-20 mb-3 rounded-sm" />
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="w-14 h-14 rounded-full shrink-0" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>

      <div className="border-t border-line pt-3 mt-1 flex flex-col gap-2">
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>

      <Skeleton className="h-8 w-20 rounded-card mt-1" />
    </div>
  );
}
