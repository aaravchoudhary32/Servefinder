import { describe, it, expect } from "vitest";
import { validateEmbeddingText, MAX_EMBEDDING_TEXT_LENGTH } from "./validateText";

describe("validateEmbeddingText", () => {
  it("rejects a missing text field", () => {
    expect(validateEmbeddingText(undefined)).toEqual({
      ok: false,
      error: "Missing 'text' string in request body.",
    });
  });

  it("rejects a non-string text field", () => {
    expect(validateEmbeddingText(42)).toEqual({
      ok: false,
      error: "Missing 'text' string in request body.",
    });
  });

  it("rejects an empty or whitespace-only string", () => {
    expect(validateEmbeddingText("   ")).toEqual({
      ok: false,
      error: "Missing 'text' string in request body.",
    });
  });

  it("accepts text at exactly the length cap", () => {
    const text = "a".repeat(MAX_EMBEDDING_TEXT_LENGTH);
    expect(validateEmbeddingText(text)).toEqual({ ok: true, value: text });
  });

  it("rejects text one character over the length cap (regression: unbounded ML-inference payload)", () => {
    const text = "a".repeat(MAX_EMBEDDING_TEXT_LENGTH + 1);
    expect(validateEmbeddingText(text)).toEqual({
      ok: false,
      error: `'text' must be ${MAX_EMBEDDING_TEXT_LENGTH} characters or fewer.`,
    });
  });

  it("accepts normal-length text", () => {
    expect(validateEmbeddingText("Interested in animal shelters and food banks.")).toEqual({
      ok: true,
      value: "Interested in animal shelters and food banks.",
    });
  });
});
