"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CloseIcon } from "./icons";

const STORAGE_KEY = "servefinder_walkthrough_seen";

// Everything that ever writes STORAGE_KEY goes through markWalkthroughSeen
// below, so a tiny local pub-sub is enough to make useSyncExternalStore
// re-check localStorage the moment that write happens — no cross-tab
// "storage" event listener needed, since we don't need to react to other
// tabs/windows, just to our own dismiss() call.
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Any stored value at all (even something malformed/unexpected) means
// "don't show it again" — matches the pre-existing check, which never
// required the value to be exactly "1".
function getHasSeenWalkthrough(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) != null;
  } catch {
    // localStorage can throw in some privacy-mode browser configs — fail
    // closed (treat as already seen, never show) rather than crash.
    return true;
  }
}

// SSR (and the client's very first hydration-matching render) never has
// access to localStorage — "seen" here, same as the pre-existing
// `useState(false)` default, keeps the walkthrough hidden until the real
// client-only value is known, with no hydration mismatch: this is the
// exact value the server rendered with, so the client's first paint
// matches it exactly before useSyncExternalStore swaps in the real one.
function getHasSeenWalkthroughServerSnapshot(): boolean {
  return true;
}

function markWalkthroughSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Same privacy-mode fallback as above — worst case this reappears
    // next visit, which is a minor annoyance, not a broken feature.
  }
  for (const listener of listeners) listener();
}

const STEPS = [
  {
    title: "Classic vs. semantic matching",
    body: "The toggle near the top switches how matches are ranked — classic compares your tags directly, semantic compares meaning. Try both and see which feels more accurate to you.",
  },
  {
    title: "Why this matches you",
    body: "Every match card shows a breakdown of interest, schedule, distance, skill, and commitment fit — so you can see exactly why something was recommended, not just a bare score.",
  },
  {
    title: "Save what you're interested in",
    body: "Click Save on any card to add it to your applications tracker. Nothing is shared with the organization until you actually apply.",
  },
  {
    title: "Search and filter",
    body: "Use the search bar and filters above your matches to narrow down by keyword, category, or commitment type — your ranked order stays the same, just narrowed.",
  },
];

// State is a plain localStorage flag, not account/server data — this is
// a "have I seen this" UI preference for this browser, not something
// worth a database round-trip or a schema change for. useSyncExternalStore
// (rather than a useEffect + setState) is what lets `visible` reflect the
// real localStorage value from the client's very first render after
// hydration, with getServerSnapshot keeping SSR and the initial client
// paint in agreement (both "seen", i.e. hidden) so there's no mismatch.
export default function OnboardingWalkthrough() {
  const hasSeenWalkthrough = useSyncExternalStore(
    subscribe,
    getHasSeenWalkthrough,
    getHasSeenWalkthroughServerSnapshot
  );
  const visible = !hasSeenWalkthrough;
  const [step, setStep] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) {
      cardRef.current?.focus();
    }
  }, [visible, step]);

  function dismiss() {
    markWalkthroughSeen();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      dismiss();
    }
  }

  if (!visible) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Dashboard walkthrough, step ${step + 1} of ${STEPS.length}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="animate-fade-in-up fixed bottom-6 right-6 z-30 w-[calc(100vw-3rem)] max-w-sm bg-white border border-line rounded-card shadow-lift p-5 focus:outline-none focus:ring-2 focus:ring-moss/40"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="font-mono text-xs uppercase tracking-widest text-moss">
          Quick tour · {step + 1}/{STEPS.length}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Skip walkthrough"
          className="text-ink/70 hover:text-ink transition-colors duration-150 shrink-0 -m-1 p-1"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>

      <h3 className="font-display text-base font-semibold mb-1.5">{current.title}</h3>
      <p className="text-sm text-ink/70 leading-relaxed mb-4">{current.body}</p>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={dismiss}
          className="text-sm text-ink/70 underline underline-offset-2 hover:text-ink transition-colors"
        >
          Skip
        </button>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-sm px-3 py-1.5 rounded-card border border-line text-ink/70 hover:border-moss hover:text-ink transition-all duration-150"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}
            className="text-sm px-3 py-1.5 rounded-card bg-moss text-white hover:bg-moss-dark transition-all duration-150"
          >
            {isLast ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
