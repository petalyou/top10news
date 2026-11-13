// OpenNext adapter config for Cloudflare Workers.
// Prerendered pages (the legal pages) are served from Workers static assets; nothing on the
// site uses ISR, and editions are read live from the SNAPSHOTS R2 bucket.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
