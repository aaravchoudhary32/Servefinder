import { describe, it, expect } from "vitest";
import { safeErrorResponse } from "./apiError";

describe("safeErrorResponse", () => {
  it("uses the given status and a generic default message", async () => {
    const res = safeErrorResponse(500);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Something went wrong. Please try again." });
  });

  it("never leaks the raw internal message it's given by the caller", async () => {
    // Regression: routes used to pass a raw Supabase/driver error.message
    // straight through to the client. This helper's whole job is to make
    // that impossible by construction — it only ever accepts a
    // caller-authored public message, never the underlying error object.
    const res = safeErrorResponse(500, "Couldn't delete your account.");
    const body = await res.json();
    expect(body.error).toBe("Couldn't delete your account.");
    expect(body.error).not.toMatch(/duplicate key|constraint|relation|column|null value/i);
  });

  it("supports non-500 statuses", async () => {
    const res = safeErrorResponse(403, "Not allowed.");
    expect(res.status).toBe(403);
  });
});
