import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "./cronAuth";

function requestWithAuth(header?: string) {
  return new NextRequest("http://localhost/api/cron/mark-stale", {
    headers: header ? { authorization: header } : {},
  });
}

describe("isAuthorizedCronRequest", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("rejects a request with no Authorization header", () => {
    process.env.CRON_SECRET = "test-secret-value";
    expect(isAuthorizedCronRequest(requestWithAuth())).toBe(false);
  });

  it("rejects a request when CRON_SECRET isn't configured", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedCronRequest(requestWithAuth("Bearer anything"))).toBe(false);
  });

  it("rejects a wrong secret", () => {
    process.env.CRON_SECRET = "test-secret-value";
    expect(isAuthorizedCronRequest(requestWithAuth("Bearer wrong-secret-value"))).toBe(false);
  });

  it("rejects a secret of a different length than expected (regression: timingSafeEqual throws on length mismatch)", () => {
    process.env.CRON_SECRET = "test-secret-value";
    expect(isAuthorizedCronRequest(requestWithAuth("Bearer short"))).toBe(false);
    expect(
      isAuthorizedCronRequest(requestWithAuth("Bearer test-secret-value-but-much-longer"))
    ).toBe(false);
  });

  it("rejects a near-miss secret that differs in only the last character", () => {
    process.env.CRON_SECRET = "test-secret-value";
    expect(isAuthorizedCronRequest(requestWithAuth("Bearer test-secret-valuz"))).toBe(false);
  });

  it("accepts the correct secret", () => {
    process.env.CRON_SECRET = "test-secret-value";
    expect(isAuthorizedCronRequest(requestWithAuth("Bearer test-secret-value"))).toBe(true);
  });
});
