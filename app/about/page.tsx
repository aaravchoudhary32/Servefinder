import LegalPageLayout from "@/components/LegalPageLayout";
import { getPublicOpportunityCount } from "@/lib/publicStats";

export const revalidate = 3600;

export default async function AboutPage() {
  const opportunityCount = await getPublicOpportunityCount();

  return (
    <LegalPageLayout eyebrow="About" title="About ServeFinder" updated="September 2026">
      <p>
        ServeFinder is a free tool that helps students find volunteering that actually fits their
        life — matched to their age, interests, schedule, and how far they can travel, instead of
        scrolling through a long, unfiltered list. It was built by a student, for students.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">Who it&apos;s for</h2>
      <p>
        Students looking for real volunteer or service opportunities, and the organizations that
        offer them. Organizations can create a free account to list their own opportunities and
        review who&apos;s applied.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">Where opportunities come from</h2>
      <p>
        {opportunityCount !== null ? (
          <>Right now, ServeFinder lists {opportunityCount.toLocaleString()} opportunities from</>
        ) : (
          <>ServeFinder lists opportunities from</>
        )}{" "}
        local organizations and public programs. Some are added automatically from an
        organization&apos;s own public listing page; others are researched and entered by hand.
        Either way, every opportunity is reviewed before it&apos;s published — we check that it has
        a real link back to the organization, a clear description, and enough information for a
        student to know whether it&apos;s a fit (minimum age, schedule, location or virtual
        format). That review confirms a listing is genuine and complete; it doesn&apos;t mean
        ServeFinder has independently verified every detail is still accurate today, which is why
        we show when a listing was last checked and let anyone report something that looks wrong
        (see &ldquo;Report an issue&rdquo; on any listing).
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">How matching works</h2>
      <p>
        After a student shares their age, location, interests, skills, availability, and how far
        they&apos;re willing to travel, ServeFinder ranks opportunities against that profile.
        Ranking weighs interest fit, schedule fit, distance, relevant skills, and commitment type —
        each shown as its own percentage on a match, not a single hidden score. An opportunity that
        doesn&apos;t meet a student&apos;s minimum-age or maximum-distance requirement is excluded
        entirely, never shown with a lower score. A second, optional matching mode compares the
        meaning of an opportunity&apos;s description to a student&apos;s interests, for cases where
        the exact wording differs but the fit is still strong.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">What ServeFinder doesn&apos;t do</h2>
      <p>
        ServeFinder doesn&apos;t guarantee that a listed opportunity is currently accepting
        volunteers, that an application will be accepted, or that an organization will respond.
        Always confirm current details — hours, requirements, whether they&apos;re still
        recruiting — directly with the organization before making plans. See our{" "}
        <a href="/terms" className="underline underline-offset-2 hover:text-ink">
          Terms
        </a>{" "}
        for more.
      </p>

      <p className="text-xs text-ink/60 mt-4">
        Have a question or found something that doesn&apos;t look right? See{" "}
        <a href="/contact" className="underline underline-offset-2 hover:text-ink">
          Contact
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
