"use client";

import { useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import Modal from "./Modal";
import Button from "./Button";

type ReportType = "inaccurate_listing" | "general_feedback";

type Props = {
  reportType: ReportType;
  opportunityId?: string | null;
  opportunityTitle?: string | null;
  // A plain string in every existing call site; widened to ReactNode so
  // the nav bar's desktop trigger can render a small icon plus a
  // visually-hidden label (keeps the same accessible name without the
  // full text taking up nav width at tablet-ish sizes).
  triggerLabel?: ReactNode;
  triggerClassName?: string;
};

const DEFAULT_TRIGGER_LABEL: Record<ReportType, string> = {
  inaccurate_listing: "Report an issue",
  general_feedback: "Feedback",
};

const MODAL_TITLE: Record<ReportType, string> = {
  inaccurate_listing: "Report inaccurate listing",
  general_feedback: "Send feedback",
};

const MESSAGE_PROMPT: Record<ReportType, string> = {
  inaccurate_listing: "What's wrong with this listing?",
  general_feedback: "What's on your mind?",
};

// Self-contained trigger + dialog: renders its own button, owns its own
// open/submitted/error state, and calls POST /api/reports directly —
// callers just drop this in wherever a report/feedback entry point
// belongs (an opportunity card, an org detail page, the nav bar) with
// the right `reportType` and, for a listing report, `opportunityId`.
export default function ReportIssueModal({
  reportType,
  opportunityId = null,
  opportunityTitle = null,
  triggerLabel,
  triggerClassName,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Regression: this used to reset form state via a setTimeout fired
  // from handleClose(), timed to land after the close animation. That
  // raced against a fast reopen — closing, then immediately reopening
  // and typing before the ~200ms delay elapsed, meant the delayed
  // reset fired *after* the reopen and silently wiped whatever had
  // just been typed back to "". Caught by a real e2e test (not a
  // manual click), which is exactly the class of bug a manual
  // spot-check tends to miss since a human rarely re-triggers that
  // fast. Fixed by resetting at open time instead — no timer, no race.
  function handleOpen() {
    setSubmitted(false);
    setError(null);
    setMessage("");
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Please log in to submit a report.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ reportType, message, opportunityId }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const responseBody = await res.json().catch(() => null);
      setError(responseBody?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={triggerClassName ?? "text-xs text-ink/70 hover:text-ink underline underline-offset-2"}
      >
        {triggerLabel ?? DEFAULT_TRIGGER_LABEL[reportType]}
      </button>

      <Modal isOpen={isOpen} onClose={handleClose} title={MODAL_TITLE[reportType]}>
        {submitted ? (
          <div>
            <p className="text-sm text-ink/70 mb-4">
              Thanks — an admin will review this. We can&apos;t always reply individually, but every report is
              read.
            </p>
            <Button type="button" variant="secondary" size="md" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reportType === "inaccurate_listing" && opportunityTitle && (
              <p className="text-sm text-ink/70">
                Reporting: <span className="font-medium text-ink">{opportunityTitle}</span>
              </p>
            )}
            <label htmlFor="report-message" className="text-xs font-mono uppercase tracking-wide text-ink/70">
              {MESSAGE_PROMPT[reportType]}
            </label>
            <textarea
              id="report-message"
              maxLength={2000}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border border-line rounded-card px-3 py-2 bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss/40 focus:border-moss"
            />
            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex items-center gap-2 justify-end mt-1">
              <Button type="button" variant="ghost" size="md" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="md" disabled={submitting || !message.trim()} onClick={handleSubmit}>
                {submitting ? "Sending…" : "Submit"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
