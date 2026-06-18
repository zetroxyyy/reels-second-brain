import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ==========================================================================
  // @huggingface/transformers — mark as external so Next.js doesn't bundle it.
  // In Next.js 15+/16+, this is the top-level `serverExternalPackages` key
  // (not inside `experimental`).
  // ==========================================================================
  serverExternalPackages: [
    "@huggingface/transformers",
    "onnxruntime-node",
  ],

  // ==========================================================================
  // Turbopack config (empty object = use defaults, silences the warning about
  // mixing webpack + turbopack config).
  // ==========================================================================
  turbopack: {},
};

export default nextConfig;
