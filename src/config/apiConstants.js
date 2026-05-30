/** Shared TorBox API constants (utils + server routes; no React/UI deps). */
export const API_BASE = 'https://api.torbox.app';
export const API_SEARCH_BASE = 'https://search-api.torbox.app';
export const API_VERSION = 'v1';
export const TORBOX_MANAGER_VERSION = process.env.NEXT_PUBLIC_TORBOX_MANAGER_VERSION || '0.0.0';
export const FETCH_TIMEOUT_MS = 30000;
