"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { embedAndAttach } from "@/lib/embedAndAttach";
import { normalizeListing, findDuplicate, type ExistingListing } from "@/lib/ingestion/normalize";
import { recordIngestionRun } from "@/lib/ingestion/logRun";
import { parseCsvFile, parseCsvRow, generateCsvTemplate, type CsvRowResult } from "@/lib/ingestion/csvImport";
import Button from "./Button";

const SOURCE = "csv_import";

type ExistingOpportunity = {
  id: string;
  title: string;
  source: string;
  external_id: string | null;
};

type PreviewRow = {
  rowNumber: number;
  title: string;
  parsed: CsvRowResult;
  outcome: "new" | "update" | "skip" | "invalid";
  detail: string;
  matchedId: string | null;
};

type Props = {
  organizationId: string;
  existingOpportunities: ExistingOpportunity[];
  onImportComplete: () => void;
};

function buildPreview(rows: Record<string, string>[], existing: ExistingOpportunity[]): PreviewRow[] {
  const existingListings: ExistingListing[] = existing.map((o) => ({
    id: o.id,
    source: o.source,
    external_id: o.external_id,
    title: o.title,
    organizationName: null,
  }));

  return rows.map((row, i) => {
    const parsed = parseCsvRow(row);
    const rowNumber = i + 2; // header is row 1
    const title = row.Title?.trim() || "(missing title)";

    if (parsed.status === "invalid") {
      return { rowNumber, title, parsed, outcome: "invalid", detail: parsed.errors.join("; "), matchedId: null };
    }

    const externalId = (row["External ID"]?.trim() || null) as string | null;
    const dedup = findDuplicate({ source: SOURCE, external_id: externalId, title }, existingListings);

    if (!dedup) {
      return { rowNumber, title, parsed, outcome: "new", detail: "Will be created", matchedId: null };
    }
    if (dedup.reason === "external_id") {
      return {
        rowNumber,
        title,
        parsed,
        outcome: "update",
        detail: "Matches an existing opportunity by External ID — will update it",
        matchedId: dedup.existingId,
      };
    }
    // Fuzzy title match only — same convention every scraped source
    // already uses: skip rather than silently overwrite a row that
    // merely has a similar title, since that's not a certain identity
    // match the way an exact External ID match is.
    return {
      rowNumber,
      title,
      parsed,
      outcome: "skip",
      detail: `Looks like a duplicate of an existing opportunity (similarity ${dedup.similarity.toFixed(2)}) — will be skipped`,
      matchedId: dedup.existingId,
    };
  });
}

function downloadTemplate() {
  const blob = new Blob([generateCsvTemplate()], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "opportunity-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function CsvImportPanel({ organizationId, existingOpportunities, onImportComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headerErrors, setHeaderErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file name after a fix
    if (!file) return;

    setError(null);
    setReport(null);
    setFileName(file.name);
    const text = await file.text();
    const { headerErrors: hErrors, rows } = parseCsvFile(text);
    setHeaderErrors(hErrors);
    setPreview(hErrors.length === 0 ? buildPreview(rows, existingOpportunities) : []);
  }

  async function handleConfirmImport() {
    setImporting(true);
    setError(null);
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of preview) {
      if (row.outcome === "invalid" || row.outcome === "skip") {
        skipped++;
        continue;
      }
      if (row.parsed.status !== "valid") continue; // type guard; unreachable given outcome check above

      const normalized = normalizeListing(row.parsed.raw, { source: SOURCE });
      normalized.minimum_age = row.parsed.overrides.minimum_age;
      normalized.commitment_type = row.parsed.overrides.commitment_type;
      normalized.schedule_slots = row.parsed.overrides.schedule_slots;
      normalized.interests_tags = row.parsed.overrides.interests_tags;
      normalized.skills_required = row.parsed.overrides.skills_required;

      const payload = { ...normalized, organization_id: organizationId };

      if (row.outcome === "new") {
        const { data, error: insertError } = await supabase
          .from("opportunities")
          .insert(payload)
          .select("id")
          .single();
        if (insertError || !data) {
          skipped++;
          continue;
        }
        created++;
        embedAndAttach(data.id, normalized.description ?? normalized.title);
      } else if (row.outcome === "update" && row.matchedId) {
        const { error: updateError } = await supabase.from("opportunities").update(payload).eq("id", row.matchedId);
        if (updateError) {
          skipped++;
          continue;
        }
        updated++;
        embedAndAttach(row.matchedId, normalized.description ?? normalized.title);
      }
    }

    await recordIngestionRun(supabase, {
      source: SOURCE,
      status: "success",
      listingsFound: preview.length,
      listingsInserted: created,
      listingsUpdated: updated,
      listingsSkippedDuplicate: skipped,
    });

    setImporting(false);
    setReport({ created, updated, skipped });
    setPreview([]);
    onImportComplete();
  }

  function reset() {
    setFileName(null);
    setHeaderErrors([]);
    setPreview([]);
    setReport(null);
    setError(null);
  }

  const validCount = preview.filter((r) => r.outcome === "new" || r.outcome === "update").length;

  return (
    <div className="bg-white border border-line rounded-card shadow-soft p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-lg font-semibold">Bulk import from CSV</h3>
          <p className="text-sm text-ink/70 mt-1">
            Add or update many opportunities at once. Columns must match the template exactly.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={downloadTemplate} type="button">
            Download template
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)} type="button">
            {open ? "Close" : "Import CSV"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-5 flex flex-col gap-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="text-sm"
          />

          {headerErrors.length > 0 && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2">
              <p className="font-medium mb-1">{fileName} couldn&apos;t be read:</p>
              <ul className="list-disc list-inside">
                {headerErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2">{error}</p>
          )}

          {preview.length > 0 && (
            <>
              <div className="bg-board border border-line rounded-card overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left bg-white sticky top-0">
                        <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-ink/70">Row</th>
                        <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-ink/70">Title</th>
                        <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-ink/70">Status</th>
                        <th className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-ink/70">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {preview.map((row) => (
                        <tr key={row.rowNumber}>
                          <td className="px-3 py-2 text-ink/70 font-mono">{row.rowNumber}</td>
                          <td className="px-3 py-2 truncate max-w-[16rem]">{row.title}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-[0.65rem] font-mono uppercase tracking-wide px-2 py-1 rounded-card border whitespace-nowrap ${
                                row.outcome === "new"
                                  ? "bg-moss-light text-moss-dark border-moss/30"
                                  : row.outcome === "update"
                                  ? "bg-marigold-light text-marigold-dark border-marigold/30"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }`}
                            >
                              {row.outcome}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-ink/70">{row.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="md"
                  type="button"
                  disabled={importing || validCount === 0}
                  onClick={handleConfirmImport}
                >
                  {importing ? "Importing…" : `Import ${validCount} opportunit${validCount === 1 ? "y" : "ies"}`}
                </Button>
                <button
                  type="button"
                  onClick={reset}
                  className="text-sm text-ink/70 underline underline-offset-2 hover:text-ink transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {report && (
            <div className="text-sm text-moss-dark bg-moss-light border border-moss/30 rounded-card px-3 py-2">
              Done. {report.created} created, {report.updated} updated, {report.skipped} skipped.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
