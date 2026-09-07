// A typed contract for what a source connector does, formalizing the
// shape every file in lib/ingestion/sources/ already follows implicitly
// (fetch -> parse -> normalize -> validate -> dedupe -> stage, with a
// shared normalizeListing()/findDuplicate() from ./normalize.ts and a
// shared recordIngestionRun() for audit logging). This is documentation
// and a shape a NEW connector can implement directly — it deliberately
// does not require rewriting the 11 existing sources, which are already
// correct, already tested, and already follow this shape in substance
// even though none of them import this type. Retrofitting them to
// literally implement `Connector` is future work, not required for the
// interface to be useful today.
//
// See lib/ingestion/sources/specialOlympicsAZ.ts for the fullest
// worked example of every step below in a single real file.

export type RawPage = {
  url: string;
  html?: string;
  json?: unknown;
};

export type ParsedListing = Record<string, unknown>;

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

export type DedupResult =
  | { isDuplicate: false }
  | { isDuplicate: true; existingId: string; reason: "external_id" | "fuzzy_match" | "fingerprint"; similarity: number };

export type DryRunSummary = {
  wouldCreate: number;
  wouldUpdate: number;
  wouldSkipAsDuplicate: number;
  sampleTitles: string[];
};

export type ConnectorHealth = {
  status: "active" | "error" | "paused";
  lastAttemptedAt: string;
  lastSuccessfulAt: string | null;
  lastErrorMessage: string | null;
};

/**
 * Every method after `fetch` is deliberately synchronous-shaped (pure
 * function, no I/O) except where noted — that's what makes `dryRun`
 * possible at all: it runs the exact same parse/normalize/validate/
 * dedupe pipeline as a real run, just without the final `stage` write.
 */
export interface Connector {
  readonly sourceName: string; // must match an ingestion_sources.source_name row

  /** Network/browser I/O only — no parsing here. */
  fetch(): Promise<RawPage[]>;

  /** Pure. Extracts individual listings from one fetched page. */
  parse(page: RawPage): ParsedListing[];

  /** Pure. Wraps normalizeListing() from ./normalize.ts. */
  normalize(listing: ParsedListing): unknown; // NormalizedOpportunity, kept loose here to avoid a circular import

  /** Pure. Required fields present, values in range, no fabricated data. */
  validate(normalized: unknown): ValidationResult;

  /** Pure given `existing`. Wraps findDuplicate() plus, once available, fingerprint comparison. */
  dedupe(normalized: unknown, existing: unknown[]): DedupResult;

  /** The only step with a DB write. Inserts with review_status: "pending". */
  stage(normalized: unknown): Promise<{ id: string }>;

  /** Runs fetch -> parse -> normalize -> validate -> dedupe without calling stage(). */
  dryRun(): Promise<DryRunSummary>;

  /** Writes to ingestion_sources — see ./updateSourceHealth.ts, which every existing connector's cron route already calls independent of this interface. */
  reportHealth(): Promise<ConnectorHealth>;
}
