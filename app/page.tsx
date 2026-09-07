import OpportunityCard from "@/components/OpportunityCard";
import { PinIcon } from "@/components/icons";
import { getPublicOpportunityCount } from "@/lib/publicStats";

// Refreshed hourly rather than on every request — a real, live count,
// but this is a marketing page, not a live dashboard, and doesn't need
// to hit the database on every visit.
export const revalidate = 3600;

const sampleMatches = [
  {
    title: "STEM Tutor",
    org: "Downtown Public Library",
    distance: "8 miles away",
    schedule: "Saturday mornings",
    minAge: 15,
    category: "STEM",
    matchScore: 94,
    breakdown: {
      interestFit: 100,
      scheduleFit: 100,
      distanceFit: 84,
      skillFit: 90,
      commitmentFit: 100,
    },
  },
  {
    title: "Trail Restoration Crew",
    org: "Riverside Conservancy",
    distance: "4 miles away",
    schedule: "Sunday afternoons",
    minAge: 14,
    category: "Environment",
    matchScore: 88,
    breakdown: {
      interestFit: 100,
      scheduleFit: 60,
      distanceFit: 92,
      skillFit: 0,
      commitmentFit: 100,
    },
  },
  {
    title: "Hospital Front Desk Helper",
    org: "St. Anne's Medical Center",
    distance: "12 miles away",
    schedule: "Weekday evenings",
    minAge: 16,
    category: "Healthcare",
    matchScore: 76,
    breakdown: {
      interestFit: 100,
      scheduleFit: 40,
      distanceFit: 40,
      skillFit: 0,
      commitmentFit: 100,
    },
  },
];

export default async function Home() {
  const opportunityCount = await getPublicOpportunityCount();

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen">
      <section className="bg-board">
        <div className="max-w-5xl mx-auto px-6 pt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-moss text-white">
              <PinIcon className="w-4 h-4" />
            </span>
            <span className="font-display text-sm font-semibold whitespace-nowrap">
              ServeFinder
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/login?mode=login"
              className="text-sm px-4 py-2 rounded-card border border-line text-ink/70 hover:border-moss hover:text-ink hover:shadow-pop transition-all duration-200 ease-smooth"
            >
              Log In
            </a>
            <a
              href="/login?mode=signup"
              className="text-sm px-4 py-2 rounded-card bg-moss text-white font-medium hover:bg-moss-dark hover:shadow-pop transition-all duration-200 ease-smooth"
            >
              Sign Up
            </a>
          </div>
        </div>

        <div className="animate-fade-in-up max-w-5xl mx-auto px-6 pt-16 pb-20 text-center">
          <p className="inline-block font-mono text-xs uppercase tracking-widest text-moss-dark bg-moss-light px-3 py-1 rounded-full mb-6">
            For students, by a student
          </p>
          <h1 className="font-display text-4xl md:text-6xl font-semibold leading-[1.05] text-ink text-balance">
            Find volunteering that
            <br />
            actually fits your life.
          </h1>
          <p className="mt-6 text-lg text-ink/70 max-w-xl mx-auto leading-relaxed">
            Tell us your interests, schedule, and how far you can travel.
            We&apos;ll match you with real local opportunities &mdash; no
            endless scrolling.
          </p>
          <div className="mt-9">
            <a
              href="/onboarding"
              className="inline-block bg-moss text-white font-medium px-7 py-3.5 rounded-card shadow-soft hover:bg-moss-dark hover:shadow-pop hover:-translate-y-0.5 transition-all duration-200 ease-smooth"
            >
              Find My Matches
            </a>
          </div>
          {opportunityCount !== null && (
            <p className="mt-6 text-sm text-ink/70">
              {opportunityCount.toLocaleString()} opportunities from local organizations and public
              programs, updated as new ones are added.
            </p>
          )}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-24">
        <h2 className="font-display text-sm uppercase tracking-widest text-ink/70 mb-2">
          What a match looks like
        </h2>
        <p className="text-sm text-ink/70 mb-6">
          Example matches below &mdash; sign up to see real opportunities matched to you.
        </p>
        <div className="flex flex-col gap-4">
          {sampleMatches.map((m, i) => (
            <div
              key={m.title}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <OpportunityCard {...m} />
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink/70">
          <a href="/about" className="hover:text-ink underline-offset-2 hover:underline">
            About
          </a>
          <a href="/privacy" className="hover:text-ink underline-offset-2 hover:underline">
            Privacy
          </a>
          <a href="/terms" className="hover:text-ink underline-offset-2 hover:underline">
            Terms
          </a>
          <a href="/contact" className="hover:text-ink underline-offset-2 hover:underline">
            Contact
          </a>
        </div>
      </footer>
    </main>
  );
}
