# Complexity

[ARCHITECTURE.md](./ARCHITECTURE.md) explains *why* the data pipeline is
shaped the way it is. This document is the companion piece: for the three
places in that pipeline that do real algorithmic work — ranking
opportunities, deduplicating ingested listings, and normalizing raw
source data — what their actual time/space complexity is, and why that's
the right call at this app's current scale rather than an oversight.

Quick reference, detail below:

| Component | Time | Space | Dominant cost |
|---|---|---|---|
| `rankOpportunities()` / `rankOpportunitiesSemantic()` | O(N log N) | O(N) | sorting N opportunities |
| `findDuplicate()`, one candidate | O(E · L²) | O(E) | Levenshtein against every existing row |
| `findDuplicate()`, one fetch run | O(M · E · L²) | O(E) | M candidates, each scanning all E existing rows |
| `normalizeListing()`, one listing | O(T) | O(T) | ~15–20 independent regex passes over the listing's text |
| `normalizeListing()`, one fetch run | O(M · T) | O(T) | linear in total text volume, no per-run blowup |

Where **N** = opportunities in the catalog, **E** = existing opportunities
scanned for dedup (currently all of them, any source), **M** = listings a
single fetch run parses from one source (single digits to low tens
today), **L** = typical title/org-name string length (tens of
characters), **T** = typical listing text length (title + description,
a few hundred characters), **D** = embedding dimension (384, a fixed
constant of the model, not an input size).

---

## 1. Matching algorithm — `rankOpportunities()` / `rankOpportunitiesSemantic()`

`lib/matching.ts`. For a single opportunity, `scoreOpportunity()` does a
fixed handful of O(1)-ish operations: an age comparison, three
`overlapRatio()` calls (interest, schedule, skill), a distance-falloff
calculation, and a commitment-preference lookup. `overlapRatio(a, b)`
builds a `Set` from `b` (O(|b|)) and filters `a` against it (O(|a|) with
O(1) average `Set.has()`), so it's O(|a| + |b|) — but `a` and `b` here
are a student's interest/skill/availability lists and an opportunity's
tag/requirement lists, which in practice are single-digit-length arrays.
Call that bound **F** (field size); scoring one opportunity is O(F),
and F is a small constant, not something that grows with the catalog.

`rankOpportunities()` maps `scoreOpportunity()` over all N opportunities
— O(N · F) — then sorts the results by score — O(N log N). Since F is a
small constant, the map is effectively linear and the **sort dominates**:
**O(N log N) time, O(N) space** for the result array (one score +
breakdown object per opportunity; no structure that grows faster than
the input).

**Semantic scoring adds a fixed-cost step, not a new complexity class.**
`scoreOpportunitySemantic()` replaces exact tag-overlap with
`cosineSimilarity()` over two 384-dimension embedding vectors (see
`lib/vectorMath.ts`). That's O(D) per call — but D is the model's fixed
output dimension, a constant baked into the choice of
`Xenova/all-MiniLM-L6-v2`, not a variable that scales with N or with
anything else in this app. Swapping the interest-fit signal from
tag-overlap to cosine similarity changes the constant factor per
opportunity, not the O(N log N) shape of `rankOpportunitiesSemantic()`
as a whole.

**Where this runs matters as much as its Big-O.** The dashboard fetches
the *entire* `opportunities` table into the browser on every load and
runs the full O(N log N) ranking there, client-side, unpaginated — no
server-side filtering, no precomputed index. That's a deliberate choice
for this app's actual scale (a local/regional catalog — dozens to low
hundreds of rows across the two ingestion sources today): O(N log N)
over a few hundred short JS objects is sub-millisecond work, and
building server-side pagination or a ranking index would be real
engineering effort spent on a problem that doesn't exist yet. The
trigger to revisit this is concrete, not vague: once N reaches the
range where shipping the whole table to a browser and sorting it
client-side becomes perceptible (tens of thousands of rows, not
hundreds), the fix is server-side filtering/pagination — at which point
`rankOpportunities()` itself barely changes, since it's already a pure
function over whatever opportunity list it's handed.

## 2. Dedup check — `findDuplicate()`

`lib/ingestion/normalize.ts`. This is the pipeline's most expensive step
per unit of input, and worth being precise about.

**The exact-match path is a linear scan, not a hash lookup**, despite
matching on what is effectively a compound key. `existing.find(e =>
e.source === candidate.source && e.external_id === candidate.external_id)`
is O(E) — E being however many existing opportunity rows were fetched
into memory for this run (currently *every* opportunity, any source; see
[ARCHITECTURE.md §4](./ARCHITECTURE.md#4-dedup) for why cross-source
collisions matter). This mirrors a real unique index in Postgres
(`opportunities_source_external_id_idx`), but the check itself happens
in application code against an in-memory snapshot rather than as an
indexed SQL lookup — meaning the *correctness* guarantee comes from the
Postgres index (a race would still be caught, as an insert error, at
write time), while the *performance* of the exact-match path is
needlessly O(E) instead of O(1) when it could instead be pushed down as
a single indexed query. At E in the tens to low hundreds (today's real
count), this is invisible; it's flagged here because it's the very
first thing to change if E ever grows enough for a linear scan through
the whole table to actually register.

**The fuzzy-match fallback is genuinely quadratic-ish, and that's the
real cost center.** For every candidate, it loops over all E existing
listings and computes `stringSimilarity()` (Levenshtein edit distance)
against title (and org name, when both sides have one) for each —
O(E) comparisons per candidate. Levenshtein itself is the classic O(L₁ ·
L₂) time-and-space dynamic-programming table, where L is string length.
Title and organization-name strings are short — tens of characters,
effectively a constant at this app's data — so each individual
comparison is cheap; the DP table isn't optimized down to O(min(L₁,
L₂)) rolling-row space because at these string lengths that
optimization would save kilobytes that are never actually a problem.
**One fetch run, processing M candidates against E existing rows, is
O(M · E · L²)** — quadratic in the product of run size and catalog
size. Verified in practice against both real sources
([Chesapeake Humane](./lib/ingestion/sources/chesapeakeHumane.ts): ~10
roles; [Foodbank of Southeastern Virginia and the Eastern
Shore](./lib/ingestion/sources/foodbankSeva.ts): 3 tracks) — with M in
the single digits and E in the tens, this is effectively instant. **The
concrete trigger to revisit it**: if the catalog (E) grows into the
thousands, or a future source posts hundreds of listings per run (M),
the O(M · E) full-table fuzzy scan becomes the pipeline's bottleneck
well before anything else does. The fix at that point isn't a cleverer
Levenshtein — it's not doing the comparison in application code at all:
either a Postgres `pg_trgm` trigram-similarity query (push the fuzzy
search into the database, index-backed), or scoping the fuzzy pass to
candidates sharing an organization (cutting the effective E to "rows
from this one org" instead of the whole catalog). Neither is warranted
yet; both are straightforward additions to `findDuplicate()`'s existing
shape when they are.

**Why not just always require an `external_id` and skip fuzzy matching
entirely?** Because the whole reason fuzzy matching exists is the case
where one doesn't exist — a human typing a listing into `/admin` has no
`external_id` at all (§4 of ARCHITECTURE.md), so the exact-match index
can never catch a hand-entered row that duplicates a freshly-scraped
one. The quadratic cost is the price of catching that specific,
real case, not an accident.

## 3. Normalization pipeline — `normalizeListing()`

`lib/ingestion/normalize.ts`. `buildLookup()` and the `pick*()` field
lookups are O(K) and O(C) respectively — K being the raw listing's
field count (typically under 20) and C the number of candidate field
names tried per logical field (a short fixed list, e.g. `["title",
"name", "position", "role", ...]`) — both small constants, dominated by
the text-inference work below.

**`inferCategory()`, `inferInterestTags()`, `extractMinimumAge()`,
`inferCommitmentType()`, and `inferScheduleSlots()` each independently
scan the listing's combined title+description text** with their own set
of regex/keyword tests: category inference alone is 8 categories ×
~8 keywords each = ~64 `containsKeyword()` tests, each a single-pass
regex match over the text (length **T**) — O(T) per test,
O(64T) ≈ **O(T)** for the whole function since 64 is a constant. Age
extraction tries up to 6 ordered patterns, schedule/commitment
inference a similarly small fixed set — each **O(T)** for the same
reason. **The whole function is O(T)**, linear in listing text length,
with a real but bounded constant factor: roughly 15–20 independent
full-text scans of the same string, rather than one shared tokenization
pass that all the inference rules read from.

**That repeated-scanning is a deliberate trade-off, not an oversight.**
A single shared tokenizer feeding all the inference rules would cut the
constant factor, at the cost of coupling every rule (category keywords,
age patterns, schedule patterns) to one shared parsing structure that
all of them would need to agree on. Keeping each inference function as
an independent, literal string/regex scan is what let the category
false-positive bug (documented in
[ARCHITECTURE.md §3](./ARCHITECTURE.md#3-normalize) — `"cat"` matching
inside `"education"`) get caught, tested, and fixed in isolation without
touching anything else in the file. At the data volume this pipeline
actually processes — one fetch run parses single digits to low tens of
listings, each a few hundred characters — the difference between one
shared scan and twenty independent ones is microseconds. **One fetch
run is O(M · T)**: linear in total text volume, with no quadratic term
anywhere in this stage (unlike dedup) — normalization cost never
compounds across listings within a run, since each listing is processed
independently of every other one.

---

## Why these choices, at this scale

Every complexity number above was chosen against the same yardstick:
this is a local/regional volunteer catalog fed by a small, slowly-growing
number of scraped sources plus manual admin entry — not a system meant
to index the internet. N (catalog size) and E (existing-row count for
dedup) are the two numbers that actually matter for when today's choices
would need revisiting, and both are currently in the tens-to-low-hundreds
range, verified by running both real fetchers end to end against the
live database rather than assumed. **O(N log N) client-side ranking**
and **O(M · E · L²) dedup** are both the simplest correct implementation
available, not the most scalable one — and the scalable versions
(server-side pagination for ranking, `pg_trgm`/org-scoped fuzzy search
for dedup) are both incremental changes to the existing function
signatures, not rewrites, whenever N or E actually justify them.
