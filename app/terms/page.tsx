import LegalPageLayout from "@/components/LegalPageLayout";

export default function TermsPage() {
  return (
    <LegalPageLayout eyebrow="Terms" title="Terms of use" updated="September 2026">
      <p>
        By using ServeFinder, you agree to the following. This is a plain-language summary, not a
        substitute for legal advice.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">What ServeFinder is</h2>
      <p>
        A free directory and matching tool connecting students with volunteer and service
        opportunities offered by third-party organizations. ServeFinder is not the organization
        offering any listed opportunity, and is not a party to any arrangement between a student
        and an organization.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">No guarantee</h2>
      <p>
        Listing an opportunity does not mean it is currently accepting volunteers, that an
        application will be accepted, or that the organization will respond. Details like hours,
        eligibility, and requirements can change without notice. Always confirm current
        information directly with the organization before making plans. ServeFinder reviews
        listings before publishing them but does not independently verify that every detail
        remains accurate at every moment — see the &ldquo;Last verified&rdquo; date on a listing,
        and use &ldquo;Report an issue&rdquo; if something looks wrong.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">Students, including minors</h2>
      <p>
        ServeFinder is intended for use by students, including those under 18. A student under 18
        should involve a parent or guardian in decisions about volunteering, especially anything
        involving travel, in-person contact with unfamiliar adults, or a financial commitment.
        Individual opportunity listings may note their own age, consent, or supervision
        requirements set by the organization — those requirements are the organization&apos;s, not
        ServeFinder&apos;s, and should be confirmed directly with them.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">Organizations</h2>
      <p>
        If you create an organization account, you&apos;re responsible for the accuracy of the
        information you submit and for keeping it up to date. We may decline to publish, or may
        remove, a listing or account that is inaccurate, misleading, or violates these terms.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">Acceptable use</h2>
      <p>
        Use ServeFinder for its intended purpose — finding or offering real volunteer
        opportunities. Don&apos;t submit false information, attempt to disrupt the service, or use
        it to collect other users&apos; information for an unrelated purpose.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">No liability</h2>
      <p>
        ServeFinder is provided &ldquo;as is,&rdquo; without warranty of any kind. We are not
        responsible for the conduct of any organization or student, or for the outcome of any
        volunteer arrangement made through the platform.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">Changes</h2>
      <p>
        We may update these terms, the service, or discontinue it, at any time. Continued use
        after a change means you accept the updated terms.
      </p>

      <p className="text-xs text-ink/60 mt-4">
        Questions about these terms? See{" "}
        <a href="/contact" className="underline underline-offset-2 hover:text-ink">
          Contact
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
