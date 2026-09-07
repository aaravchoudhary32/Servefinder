"use client";

import { useId, useState } from "react";

type Props = {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
};

// A plain search box only appears once a list is long enough that
// scanning it visually stops being the fastest way to find one option
// — most of this app's tag lists (interests, skills, availability) are
// well under this, but some taxonomy focus lists (STEM's 16, for
// instance) are exactly the kind of "can I just type instead" case
// this exists for.
const SEARCH_THRESHOLD = 8;

export default function TagSelect({ label, options, selected, onChange }: Props) {
  const labelId = useId();
  const searchInputId = useId();
  const [query, setQuery] = useState("");

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const showSearch = options.length > SEARCH_THRESHOLD;
  const visibleOptions = showSearch
    ? options.filter((opt) => opt.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div>
      <span id={labelId} className="block text-xs font-mono uppercase tracking-wide text-ink/70 mb-2">
        {label}
      </span>
      {showSearch && (
        <>
          <label htmlFor={searchInputId} className="sr-only">
            Search {label.toLowerCase()}
          </label>
          <input
            id={searchInputId}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="w-full max-w-xs border border-line rounded-card px-3 py-1.5 text-sm bg-white mb-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
          />
        </>
      )}
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {visibleOptions.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => toggle(opt.value)}
              aria-pressed={active}
              // py-3 (not the app's more common py-1.5) specifically to
              // clear WCAG 2.5.5's 44px touch-target minimum — measured
              // at 34px tall on a 375px mobile viewport before this
              // change, across every broad-interest, focus, skill, and
              // availability chip in onboarding and Settings, the exact
              // UI this launch pass was asked to give special attention.
              className={`text-sm px-3 py-3 rounded-card border transition-all duration-150 active:scale-95 ${
                active
                  ? "bg-moss text-white border-moss shadow-soft"
                  : "bg-white text-ink border-line hover:border-moss hover:shadow-pop"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        {showSearch && visibleOptions.length === 0 && (
          <p className="text-sm text-ink/70">No matches for &ldquo;{query}&rdquo;.</p>
        )}
      </div>
    </div>
  );
}
