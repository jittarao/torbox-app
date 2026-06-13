/**
 * Torrent Status Utility
 * Determines torrent status based on multiple fields
 * Ported from frontend statusHelpers.js for consistency across the codebase
 *
 * @param {Object} torrent - Torrent object from API
 * @returns {string} - Status: 'queued', 'failed', 'stalled', 'metadl',
 *                     'checking_resume_data', 'completed', 'downloading',
 *                     'seeding', 'uploading', 'inactive', 'unknown'
 */
export function getTorrentStatus(torrent) {
  // Explicit status from API (set by ApiClient on getqueued items)
  if (torrent.status && String(torrent.status).toLowerCase() === 'queued') {
    return 'queued';
  }

  // Check download_state for specific statuses
  // These checks match the frontend STATUS_OPTIONS logic where each status
  // has specific active requirements
  if (torrent.download_state) {
    const state = torrent.download_state.toLowerCase();

    // Failed: download_state contains "failed" and not active (matches UI STATUS_OPTIONS)
    if (state.includes('failed') && !torrent.active) {
      return 'failed';
    }

    // Stalled: download_state contains "stalled" and active (matches UI STATUS_OPTIONS)
    if (state.includes('stalled') && torrent.active) {
      return 'stalled';
    }

    // MetaDL
    if (state.includes('metadl')) {
      return 'metadl';
    }

    // Checking Resume Data
    if (state.includes('checkingresumedata')) {
      return 'checking_resume_data';
    }
  }

  // Inactive: Not active, download not present
  if (!torrent.active && !torrent.download_present) {
    return 'inactive';
  }

  // Completed: Download finished, not active
  if (torrent.download_finished && torrent.download_present && !torrent.active) {
    return 'completed';
  }

  // Downloading: Active, not finished, download not present
  if (torrent.active && !torrent.download_finished && !torrent.download_present) {
    return 'downloading';
  }

  // Seeding: Download finished, download present, active
  if (torrent.download_finished && torrent.download_present && torrent.active) {
    return 'seeding';
  }

  // Uploading: Download finished, download not present, active
  if (torrent.download_finished && !torrent.download_present && torrent.active) {
    return 'uploading';
  }

  return 'unknown';
}
