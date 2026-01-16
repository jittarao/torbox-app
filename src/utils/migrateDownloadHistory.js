/**
 * One-time migration utility to migrate download history from localStorage to backend
 * This should be removed after all users have migrated
 */

const MIGRATION_FLAG_KEY = 'torboxDownloadHistoryMigrated';
const OLD_STORAGE_KEY = 'torboxDownloadHistory';

/**
 * Transform old localStorage format to new backend format
 */
function transformOldEntry(oldEntry) {
  const metadata = oldEntry.metadata || {};
  const item = metadata.item || {};

  // Extract item_name from metadata.item.name
  const itemName = item.name || null;

  // Extract file_name from metadata.item.files if fileId exists
  let fileName = null;
  if (oldEntry.fileId && item.files && Array.isArray(item.files)) {
    const file = item.files.find((f) => String(f.id) === String(oldEntry.fileId));
    fileName = file?.short_name || file?.name || null;
  }

  // Use generatedAt from old entry, or fallback to current timestamp
  const generatedAt = oldEntry.generatedAt || new Date().toISOString();

  return {
    item_id: String(oldEntry.itemId),
    file_id: oldEntry.fileId ? String(oldEntry.fileId) : null,
    url: oldEntry.url,
    asset_type: oldEntry.assetType || metadata.assetType || 'torrents',
    item_name: itemName,
    file_name: fileName,
    generated_at: generatedAt,
  };
}

/**
 * Check if migration has already been completed
 */
export function isMigrationCompleted() {
  if (typeof window === 'undefined') return true; // Server-side, skip
  return localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
}

/**
 * Mark migration as completed
 */
function markMigrationCompleted() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
}

/**
 * Migrate download history from localStorage to backend
 * @param {string} apiKey - User's API key
 * @returns {Promise<{success: boolean, migrated: number, error?: string}>}
 */
export async function migrateDownloadHistory(apiKey) {
  // Check if already migrated
  if (isMigrationCompleted()) {
    return { success: true, migrated: 0, skipped: true };
  }

  // Check if API key exists
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return { success: false, migrated: 0, error: 'API key is required' };
  }

  // Check if old localStorage data exists
  if (typeof window === 'undefined') {
    return { success: false, migrated: 0, error: 'localStorage not available' };
  }

  const oldDataString = localStorage.getItem(OLD_STORAGE_KEY);
  if (!oldDataString) {
    // No old data to migrate, mark as completed
    markMigrationCompleted();
    return { success: true, migrated: 0, skipped: true };
  }

  try {
    // Parse the JSON string
    const oldEntries = JSON.parse(oldDataString);

    if (!Array.isArray(oldEntries) || oldEntries.length === 0) {
      // Empty or invalid data, mark as completed
      markMigrationCompleted();
      localStorage.removeItem(OLD_STORAGE_KEY);
      return { success: true, migrated: 0, skipped: true };
    }

    // Transform old entries to new format
    const transformedEntries = oldEntries.map(transformOldEntry).filter(Boolean);

    if (transformedEntries.length === 0) {
      // No valid entries after transformation
      markMigrationCompleted();
      localStorage.removeItem(OLD_STORAGE_KEY);
      return { success: true, migrated: 0, skipped: true };
    }

    // Call bulk endpoint
    const response = await fetch('/api/link-history/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ entries: transformedEntries }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Migration failed:', data.error || 'Unknown error');
      return {
        success: false,
        migrated: 0,
        error: data.error || `Backend responded with status: ${response.status}`,
      };
    }

    // Success! Clear old localStorage and mark as completed
    localStorage.removeItem(OLD_STORAGE_KEY);
    markMigrationCompleted();

    console.log(
      `Successfully migrated ${data.data?.inserted || transformedEntries.length} download history entries`
    );

    return {
      success: true,
      migrated: data.data?.inserted || transformedEntries.length,
    };
  } catch (error) {
    console.error('Error during migration:', error);
    return {
      success: false,
      migrated: 0,
      error: error.message || 'Migration failed',
    };
  }
}
