import Link from "next/link";

type Props = {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  lastVerifiedAt: string | null;
};

// A directory-only organization has no opportunity to apply to — this is
// deliberately not an opportunity card with a disabled/fake button, it's
// a different kind of card entirely, pointing at the one real action
// available: go see what the organization itself publishes.
export default function ExploreOrgCard({ id, name, description, city, lastVerifiedAt }: Props) {
  return (
    <div className="bg-white border border-line rounded-card p-5 flex flex-col gap-2">
      <span className="text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border bg-white text-ink/70 border-line self-start">
        Organization directory
      </span>
      <h3 className="font-display text-lg font-semibold leading-tight">{name}</h3>
      {city && <p className="text-sm font-mono text-ink/70">{city}</p>}
      {description && <p className="text-sm text-ink/70 leading-relaxed">{description}</p>}
      {lastVerifiedAt && (
        <p className="text-xs font-mono text-ink/70">
          Last manually verified {new Date(lastVerifiedAt).toLocaleDateString()}
        </p>
      )}
      <Link
        href={`/organizations/${id}`}
        className="self-start text-sm font-medium px-3 py-1.5 rounded-card border border-line bg-white text-ink hover:border-moss hover:shadow-pop hover:-translate-y-px transition-all duration-200 ease-smooth mt-1"
      >
        View organization →
      </Link>
    </div>
  );
}
