// Server-only. Embeds free text into a 384-dim vector using a local
// model (Xenova/all-MiniLM-L6-v2 via @huggingface/transformers) — no API
// key, no per-call cost, but the first call in a fresh process downloads
// the model (~90MB) and can take several seconds; every call after that
// in the same warm process is fast.

import PipelineSingleton from "./pipeline";

export { EMBEDDING_DIMENSIONS } from "./pipeline";

export async function embed(text: string): Promise<number[]> {
  const extractor = await PipelineSingleton.getInstance();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as unknown as ArrayLike<number>);
}
