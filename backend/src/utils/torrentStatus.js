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
  // Check for queued status
  const isQueued = !torrent.download_state && !torrent.download_finished && !torrent.active;
  if (isQueued) {
    return 'queued';
  }

  // Check download_state for specific statuses
  // These checks match the frontend STATUS_OPTIONS logic where each status
  // has specific active requirements
  if (torrent.download_state) {
    const state = torrent.download_state.toLowerCase();

    // Failed: active must be false
    if (state.includes('failed') && !torrent.active) {
      if (!torrent.download_finished && !torrent.download_present) {
        return 'failed';
      }
    }

    // Stalled: active must be true
    if (state.includes('stalled') && torrent.active) {
      if (!torrent.download_finished && !torrent.download_present) {
        return 'stalled';
      }
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
