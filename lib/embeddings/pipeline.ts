// Lazily-constructed, process-wide singleton for the embedding model.
// Server-only (imports onnxruntime-node) — never import this from a
// "use client" component. Follows Hugging Face's own recommended Next.js
// pattern: https://huggingface.co/docs/transformers.js/tutorials/next
//
// The global-object trick in dev mode is required, not decorative — Next's
// dev server hot-reloads route modules on every request, which would
// otherwise re-run this file (and re-trigger the ~90MB model download) on
// every single API call during local development.

import { pipeline, env, type FeatureExtractionPipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
// Default cache dir is inside node_modules/@huggingface/transformers/.cache,
// which is part of the read-only deployment bundle on Vercel — mkdir there
// throws ENOENT in production even though it works fine locally (writable
// disk). /tmp is the one writable path serverless functions get.
env.useBrowserCache = false;
env.cacheDir = "/tmp/transformers-cache";

export const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

const buildSingleton = () =>
  class PipelineSingleton {
    static instance: Promise<FeatureExtractionPipeline> | null = null;

    static getInstance(): Promise<FeatureExtractionPipeline> {
      if (this.instance === null) {
        this.instance = pipeline("feature-extraction", MODEL_ID);
      }
      return this.instance;
    }
  };

declare global {
  var __embeddingPipelineSingleton: ReturnType<typeof buildSingleton> | undefined;
}

const PipelineSingleton: ReturnType<typeof buildSingleton> =
  process.env.NODE_ENV !== "production"
    ? (globalThis.__embeddingPipelineSingleton ??= buildSingleton())
    : buildSingleton();

export default PipelineSingleton;
