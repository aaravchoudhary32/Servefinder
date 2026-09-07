import { AvailabilityStatus, AVAILABILITY_STATUS_LABELS, AVAILABILITY_STATUS_STYLES } from "@/lib/availabilityStatus";

export default function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  return (
    <span
      className={`text-xs font-mono uppercase tracking-wide px-2.5 py-1 rounded-card border shadow-soft transition-colors duration-200 ${AVAILABILITY_STATUS_STYLES[status]}`}
    >
      {AVAILABILITY_STATUS_LABELS[status]}
    </span>
  );
}
