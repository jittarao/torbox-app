// Re-export shared automation capabilities from repo-root config/ (local dev).
// Docker copies config/ to /app/config/; this shim resolves ../../../config from src/.
export * from '../../config/ruleCapabilities.mjs';
