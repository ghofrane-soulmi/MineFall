/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional API origin (e.g. https://api.minefall.dev). Empty = same origin. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
