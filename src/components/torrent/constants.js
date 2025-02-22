export const COLUMNS = {
  id: { label: 'ID', sortable: true },
  name: { label: 'Name', sortable: true },
  size: { label: 'Size', sortable: true },
  created_at: { label: 'Added Date', sortable: true },
  updated_at: { label: 'Last Updated', sortable: true },
  download_state: { label: 'Status', sortable: true },
  progress: { label: 'Progress', sortable: true },
  ratio: { label: 'Ratio', sortable: true },
  file_count: { label: 'File Count', sortable: true },
  download_speed: { label: 'Download Speed', sortable: true },
  upload_speed: { label: 'Upload Speed', sortable: true },
  eta: { label: 'ETA', sortable: true },
  total_uploaded: { label: 'Total Uploaded', sortable: true },
  total_downloaded: { label: 'Total Downloaded', sortable: true },
  seeds: { label: 'Seeds', sortable: true },
  peers: { label: 'Peers', sortable: true },
};

export const STATUS_OPTIONS = [
    { label: 'All', value: 'all' },
    // Queued: Missing download state and other status fields
    { 
        label: 'Queued', 
        value: { 
          is_queued: true // Special flag we'll check for
        } 
    },
    // Completed: Download finished, not active
    { 
        label: 'Completed', 
        value: { 
          download_finished: true, 
          download_present: true,
          active: false 
        } 
    },
    // Downloading: Downloading, not finished, active
    { 
        label: 'Downloading', 
        value: { 
          download_finished: false, 
          active: true 
        } 
    },
    // Seeding: Download finished, seeding enabled, active
    { 
        label: 'Seeding', 
        value: { 
          download_finished: true, 
          download_present: true,
          active: true 
        } 
    },
    // Uploading: Download finished, uploading, active
    { 
        label: 'Uploading', 
        value: { 
          download_finished: true, 
          download_present: false,
          active: true 
        } 
    },
    // Stalled: Download or upload is stalled
    { 
        label: 'Stalled', 
        value: { 
          download_state: ['stalled', 'stalled (no seeds)'],
        } 
    },
    // Missing: Download finished, Download not present
    { 
        label: 'Inactive', 
        value: { 
          download_finished: true, 
          download_present: false,
          active: false
        } 
    }
];

export const Icons = {
  files: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  download: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  delete: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  play: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="10 8 16 12 10 16 10 8"/>
    </svg>
  ),
  stop: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10"/>
      <rect x="9" y="9" width="6" height="6" rx="1"/>
    </svg>
  ),
  question: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <path d="M12 17h.01"/>
    </svg>
  )
}; 