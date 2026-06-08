/**
 * Upload quota limits for LIMITED tier users.
 * UNLIMITED tier bypasses all quota checks.
 */

const DEFAULT_MAX_STORAGE_MB = 100;
const DEFAULT_MAX_FILES = 500;

export function getUploadQuotaLimits() {
  const maxStorageMb = parseInt(
    process.env.UPLOAD_LIMIT_MAX_STORAGE_MB || String(DEFAULT_MAX_STORAGE_MB),
    10
  );
  const maxFiles = parseInt(process.env.UPLOAD_LIMIT_MAX_FILES || String(DEFAULT_MAX_FILES), 10);

  return {
    maxStorageBytes: Math.max(0, maxStorageMb) * 1024 * 1024,
    maxFiles: Math.max(0, maxFiles),
    maxStorageMb: Math.max(0, maxStorageMb),
  };
}

export const UPLOAD_TIERS = {
  LIMITED: 'limited',
  UNLIMITED: 'unlimited',
};

export function isValidUploadTier(tier) {
  return tier === UPLOAD_TIERS.LIMITED || tier === UPLOAD_TIERS.UNLIMITED;
}

export function isUnlimitedTier(tier) {
  return tier === UPLOAD_TIERS.UNLIMITED;
}
