import LegalPageLayout from "@/components/LegalPageLayout";

export default function PrivacyPage() {
  return (
    <LegalPageLayout eyebrow="Privacy" title="Privacy" updated="September 2026">
      <p>
        This page describes what ServeFinder actually collects and does with it. It is not a claim
        of legal compliance with any specific law (COPPA, FERPA, GDPR, CCPA, or otherwise) — none
        has been independently reviewed or certified. If you have a legal question about your own
        situation, please consult someone qualified to answer it.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">What we collect</h2>
      <p>
        <strong>To create an account:</strong> an email address and password (handled by our
        authentication provider, Supabase — we never see or store your password ourselves).
      </p>
      <p>
        <strong>If you sign up as a student:</strong> the age, ZIP code or city, interests, skills,
        availability, and travel-distance preference you enter during onboarding — used only to
        rank opportunities for you. Which opportunities you save, apply to, and your status on
        each. Optional: whether you found a specific match helpful, and any report or feedback
        message you choose to submit.
      </p>
      <p>
        <strong>If you sign up as an organization:</strong> your organization&apos;s name,
        description, and a contact email, all shown publicly as part of your listing (this is a
        public directory by design).
      </p>
      <p>
        <strong>What we don&apos;t collect:</strong> precise GPS location (only a ZIP code or city
        you type in), browsing history outside this app, or data from any third-party ad or
        tracking network. We don&apos;t run third-party analytics or advertising scripts of any
        kind.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">Who can see what</h2>
      <p>
        Your profile (age, interests, skills, availability, saved and applied opportunities) is
        visible only to you. If you apply to an opportunity, the organization that posted it can
        see your application status and the email address on your account, so they can follow up
        with you — nothing else from your profile. No other student, and no other organization,
        can see your profile or activity. Product usage analytics (e.g. how many students viewed a
        match) are recorded without free text, age, location, interests, skills, or email.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">Your data, your control</h2>
      <p>
        From{" "}
        <a href="/settings" className="underline underline-offset-2 hover:text-ink">
          Settings
        </a>
        , you can export a complete copy of your data or permanently delete your account. Deleting
        your account removes your profile, saved opportunities, application history, and feedback;
        for an organization account, it also removes the organization&apos;s listings. This
        happens immediately and can&apos;t be undone.
      </p>

      <h2 className="font-display text-lg font-semibold text-ink mt-4">Cookies and sessions</h2>
      <p>
        ServeFinder uses only the storage needed to keep you signed in (via Supabase
        authentication) — no third-party tracking or advertising cookies.
      </p>

      <p className="text-xs text-ink/60 mt-4">
        Questions about this page? See{" "}
        <a href="/contact" className="underline underline-offset-2 hover:text-ink">
          Contact
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
