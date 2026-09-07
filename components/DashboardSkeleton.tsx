import OpportunityCardSkeleton from "./OpportunityCardSkeleton";
import Skeleton from "./Skeleton";

// Manual-audit finding: this skeleton (shown while dashboard/explore fetch
// matches) had no role/aria-live, so a screen-reader user got total
// silence during the load instead of "Loading" — nothing to indicate the
// page was working versus just blank. role="status" announces the label
// once on mount; the pulsing placeholder bars are decorative, so they're
// hidden from the accessibility tree rather than each being announced.
export default function DashboardSkeleton() {
  return (
    <div className="max-w-5xl mx-auto" role="status" aria-label="Loading matches">
      <div aria-hidden="true">
        <Skeleton className="h-3 w-28 mb-3" />
        <Skeleton className="h-9 w-full max-w-md mb-3" />
        <Skeleton className="h-4 w-full max-w-sm mb-10" />
        <div className="grid md:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <OpportunityCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
