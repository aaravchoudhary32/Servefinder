import { describe, it, expect } from "vitest";
import { friendlyAuthError } from "./authErrorMessages";

describe("friendlyAuthError", () => {
  it("maps a known Supabase message to app-voice copy", () => {
    expect(friendlyAuthError("Invalid login credentials", "fallback")).toBe(
      "That email and password combination doesn't match an account. Double-check both and try again."
    );
  });

  it("matches case-insensitively", () => {
    expect(friendlyAuthError("INVALID LOGIN CREDENTIALS", "fallback")).not.toBe("fallback");
  });

  it("maps 'User already registered'", () => {
    expect(friendlyAuthError("User already registered", "fallback")).toBe(
      "An account with that email already exists. Try logging in instead."
    );
  });

  it("maps a password-length message", () => {
    expect(friendlyAuthError("Password should be at least 6 characters.", "fallback")).toBe(
      "Your password needs to be at least 6 characters."
    );
  });

  it("maps an expired/already-used recovery session to a safe, actionable message", () => {
    expect(friendlyAuthError("Auth session missing!", "fallback")).toBe(
      "This reset link is invalid or has expired. Request a new one."
    );
  });

  it("maps a same-password rejection during password reset", () => {
    expect(friendlyAuthError("New password should be different from the old password.", "fallback")).toBe(
      "Your new password needs to be different from your current one."
    );
  });

  it("falls back to the given generic message for anything unrecognized (regression: never surface raw driver text)", () => {
    expect(friendlyAuthError("relation \"foo\" does not exist", "Something went wrong. Please try again.")).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("falls back for a missing message", () => {
    expect(friendlyAuthError(undefined, "Something went wrong. Please try again.")).toBe(
      "Something went wrong. Please try again."
    );
    expect(friendlyAuthError(null, "Something went wrong. Please try again.")).toBe(
      "Something went wrong. Please try again."
    );
  });
});
