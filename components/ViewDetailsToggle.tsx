"use client";

// Shared disclosure control for both opportunity card variants — a
// tester's core complaint was tall cards with a huge uninterrupted
// description and every field always rendered; this is the one control
// that lets a card stay compact by default while keeping every field
// reachable (never removed, just collapsed) behind an explicit,
// keyboard- and screen-reader-accessible expand/collapse.
type Props = {
  expanded: boolean;
  onToggle: () => void;
  controlsId: string;
};

export default function ViewDetailsToggle({ expanded, onToggle, controlsId }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controlsId}
      className="self-start text-sm font-medium text-moss-dark hover:text-moss underline underline-offset-2 transition-colors py-1"
    >
      {expanded ? "Show less" : "View details"}
    </button>
  );
}
