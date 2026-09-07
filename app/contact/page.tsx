import LegalPageLayout from "@/components/LegalPageLayout";

export default function ContactPage() {
  return (
    <LegalPageLayout eyebrow="Contact" title="Contact & support" updated="September 2026">
      <p>
        The fastest way to reach us is the <strong>Feedback</strong> link in the navigation bar
        once you&apos;re signed in — it goes straight to the person who maintains ServeFinder.
        Reporting a specific listing? Use the &ldquo;Report an issue&rdquo; link on that listing
        instead, so it&apos;s tied to the right record.
      </p>
      <p>
        If you haven&apos;t signed up yet, or your question is urgent (including reporting a
        security issue), reach out via{" "}
        <a
          href="https://github.com/aaravchoudhary32"
          className="underline underline-offset-2 hover:text-ink"
        >
          GitHub
        </a>
        .
      </p>
      <p>
        ServeFinder is maintained by one person, not a support team, so please don&apos;t expect an
        instant reply — every message is read, but response times vary. We won&apos;t always be
        able to reply individually to general feedback, though we do read all of it.
      </p>
    </LegalPageLayout>
  );
}
