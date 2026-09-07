const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Whole-day difference between now and a "YYYY-MM-DD" date, using UTC
// midnight boundaries on both sides so this doesn't drift by a day
// depending on the caller's local timezone.
export function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00Z`);
  const todayUTC = new Date();
  const today = new Date(
    Date.UTC(todayUTC.getFullYear(), todayUTC.getMonth(), todayUTC.getDate())
  );
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

export function deadlineLabel(days: number): string {
  if (days < 0) return "Applications closed";
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  return `Closes in ${days} days`;
}

export function deadlineBadgeClass(days: number): string {
  if (days < 0) return "bg-white text-ink/70 border-line";
  // bg-marigold-dark (not bg-marigold) — the DEFAULT marigold is too
  // light for white text to clear WCAG AA contrast (axe caught this at
  // 2.15:1, needs 4.5:1); marigold-dark against white easily clears it.
  if (days < 3) return "bg-marigold-dark text-white border-marigold-dark shadow-soft";
  return "bg-white text-ink/70 border-line";
}
