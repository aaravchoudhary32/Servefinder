export const STATUS_FLOW = ["saved", "applied", "accepted", "completed"] as const;

export type ApplicationStatus = (typeof STATUS_FLOW)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  accepted: "Accepted",
  completed: "Completed",
};

export function nextStatus(status: ApplicationStatus): ApplicationStatus | null {
  const idx = STATUS_FLOW.indexOf(status);
  return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
}
