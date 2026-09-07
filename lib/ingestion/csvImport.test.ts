import { describe, it, expect } from "vitest";
import { parseCsvRow, parseCsvFile, generateCsvTemplate, CSV_HEADERS } from "./csvImport";

function makeRow(overrides: Partial<Record<(typeof CSV_HEADERS)[number], string>> = {}) {
  return {
    Title: "Weekend Park Cleanup",
    Description: "Help clear litter along the river trail.",
    Category: "Environment",
    "Minimum Age": "13",
    Location: "",
    Latitude: "",
    Longitude: "",
    "Schedule Slots": "",
    "Interest Tags": "",
    "Skills Required": "",
    "Commitment Type": "one_time",
    "Application Deadline": "",
    "External ID": "",
    ...overrides,
  };
}

describe("parseCsvRow", () => {
  it("accepts a fully valid row and splits array fields on ';'", () => {
    const result = parseCsvRow(
      makeRow({ "Schedule Slots": "saturday_morning;sunday_afternoon", "Interest Tags": "environment;community" })
    );
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.overrides.schedule_slots).toEqual(["saturday_morning", "sunday_afternoon"]);
    expect(result.overrides.interests_tags).toEqual(["environment", "community"]);
    expect(result.overrides.minimum_age).toBe(13);
    expect(result.overrides.commitment_type).toBe("one_time");
  });

  it("treats an empty array-field cell as an empty array, not a one-item array with an empty string", () => {
    const result = parseCsvRow(makeRow({ "Skills Required": "" }));
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.overrides.skills_required).toEqual([]);
  });

  it("rejects a row missing a required field", () => {
    const result = parseCsvRow(makeRow({ Title: "" }));
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(result.errors).toContain("Title is required");
  });

  it("rejects a Category not in the app's fixed category list", () => {
    const result = parseCsvRow(makeRow({ Category: "Not A Real Category" }));
    expect(result.status).toBe("invalid");
  });

  it("matches Category case-insensitively", () => {
    const result = parseCsvRow(makeRow({ Category: "environment" }));
    expect(result.status).toBe("valid");
  });

  it("rejects a Commitment Type that isn't exactly 'one_time' or 'recurring'", () => {
    // Deliberately not lenient about display labels like "One-time" —
    // this is a database enum value, not free text.
    const result = parseCsvRow(makeRow({ "Commitment Type": "One-time" }));
    expect(result.status).toBe("invalid");
  });

  it("rejects a Minimum Age outside the plausible range", () => {
    const tooOld = parseCsvRow(makeRow({ "Minimum Age": "150" }));
    const notANumber = parseCsvRow(makeRow({ "Minimum Age": "thirteen" }));
    expect(tooOld.status).toBe("invalid");
    expect(notANumber.status).toBe("invalid");
  });

  it("rejects a non-numeric Latitude/Longitude", () => {
    const result = parseCsvRow(makeRow({ Latitude: "not-a-number" }));
    expect(result.status).toBe("invalid");
  });

  it("accepts an empty Latitude/Longitude (optional fields)", () => {
    const result = parseCsvRow(makeRow({ Latitude: "", Longitude: "" }));
    expect(result.status).toBe("valid");
  });

  it("reports every validation failure at once, not just the first", () => {
    const result = parseCsvRow(makeRow({ Title: "", Category: "Nonsense", "Minimum Age": "999" }));
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("parseCsvFile", () => {
  it("parses a well-formed CSV (including a quoted field containing a comma)", () => {
    const csv =
      'Title,Description,Category,Minimum Age,Commitment Type\n' +
      '"Trail Cleanup, Riverside",Help out,Environment,13,one_time\n';
    const result = parseCsvFile(csv);
    expect(result.headerErrors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].Title).toBe("Trail Cleanup, Riverside");
  });

  it("reports missing required columns without attempting to parse rows", () => {
    const csv = "Title,Description\nSomething,Else\n";
    const result = parseCsvFile(csv);
    expect(result.headerErrors.length).toBeGreaterThan(0);
    expect(result.rows).toEqual([]);
  });

  it("rejects a file over the row cap", () => {
    const header = "Title,Description,Category,Minimum Age,Commitment Type\n";
    const row = "Opp,Desc,Environment,13,one_time\n";
    const csv = header + row.repeat(201);
    const result = parseCsvFile(csv);
    expect(result.headerErrors.some((e) => e.includes("200"))).toBe(true);
  });
});

describe("generateCsvTemplate", () => {
  it("includes every expected header and one example data row", () => {
    const template = generateCsvTemplate();
    for (const header of CSV_HEADERS) {
      expect(template).toContain(header);
    }
    const lines = template.trim().split("\n");
    expect(lines).toHaveLength(2); // header + one example row
  });
});
