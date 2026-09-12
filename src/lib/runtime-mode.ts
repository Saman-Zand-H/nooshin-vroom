const localHost =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

/** Seeded data is a deliberate loopback-only opt-in, never a hosted fallback. */
export const localPreview =
  import.meta.env.VITE_LOCAL_PREVIEW === "true" &&
  localHost &&
  (import.meta.env.DEV || import.meta.env.MODE === "preview");
