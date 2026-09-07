import { ApplicationStatus, STATUS_LABELS } from "@/lib/applicationStatus";

const STYLES: Record<ApplicationStatus, string> = {
  saved: "bg-white text-ink/70 border-line",
  applied: "bg-marigold-light text-marigold-dark border-marigold/30",
  accepted: "bg-moss-light text-moss-dark border-moss/30",
  completed: "bg-ink text-paper border-ink",
};

export default function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`text-xs font-mono uppercase tracking-wide px-2.5 py-1 rounded-card border shadow-soft transition-colors duration-200 ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
