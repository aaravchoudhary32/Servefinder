import Skeleton from "./Skeleton";

const COLUMN_CARD_COUNTS = [2, 1, 1, 0];

// See DashboardSkeleton for why this carries role="status" +
// aria-label instead of announcing nothing during the load.
export default function ApplicationsSkeleton() {
  return (
    <div className="max-w-5xl mx-auto" role="status" aria-label="Loading applications">
      <div aria-hidden="true">
        <Skeleton className="h-3 w-32 mb-3" />
        <Skeleton className="h-9 w-full max-w-xs mb-10" />
        <div className="grid md:grid-cols-4 gap-6">
          {COLUMN_CARD_COUNTS.map((cardCount, col) => (
            <div key={col} className="flex flex-col gap-3">
              <Skeleton className="h-3 w-20" />
              {Array.from({ length: cardCount }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white border border-line rounded-card p-4 flex flex-col gap-2 shadow-soft"
                >
                  <Skeleton className="h-4 w-16 rounded-sm" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-6 w-20 rounded-card" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
