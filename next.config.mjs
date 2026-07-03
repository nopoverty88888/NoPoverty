import withPWAInit from "next-pwa";

/**
 * Runtime caching for the in-browser OCR step (Tesseract.js).
 *
 * `createWorker("eng")` pulls the wasm core, the worker script, and the English
 * traineddata from public CDNs on first use. CacheFirst here means that once the
 * 月底回收 scan has run online, the OCR assets stay available offline — the one
 * offline capability in scope (see CLAUDE.md "What's out of scope for v1").
 */
const ocrRuntimeCaching = [
  {
    urlPattern: /^https:\/\/tessdata\.projectnaptha\.com\/.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: "tesseract-langdata",
      expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 90 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  {
    urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: "tesseract-cdn",
      expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 90 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  {
    urlPattern: /^https:\/\/unpkg\.com\/tesseract.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: "tesseract-cdn",
      expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 90 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
];

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  // Disable in dev: the service worker's aggressive caching otherwise fights the
  // dev server (stale chunks / 404s). Only the production build ships a SW.
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: ocrRuntimeCaching,
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withPWA(nextConfig);
