// Pure input validation for POST /api/embeddings, split out from
// app/api/embeddings/route.ts so it can be unit-tested without pulling
// in ./pipeline (and therefore onnxruntime-node) at import time.
//
// Security audit finding (Medium): this endpoint runs real ML inference
// per call, so an unbounded 'text' length meant the per-user rate limit
// only capped *frequency*, not cost per call. 5,000 characters
// comfortably exceeds any legitimate input (a student's interests list,
// or an opportunity description — none of this app's own content
// approaches this) while bounding worst-case compute.
export const MAX_EMBEDDING_TEXT_LENGTH = 5000;

export type EmbeddingTextValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validateEmbeddingText(text: unknown): EmbeddingTextValidation {
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, error: "Missing 'text' string in request body." };
  }
  if (text.length > MAX_EMBEDDING_TEXT_LENGTH) {
    return {
      ok: false,
      error: `'text' must be ${MAX_EMBEDDING_TEXT_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: text };
}
