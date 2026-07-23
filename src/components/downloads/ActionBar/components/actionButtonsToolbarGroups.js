/** Grouped toolbar props to keep boolean prop count under react-doctor thresholds. */

export function createBulkProgress({
  isDownloading = false,
  isDeleting = false,
  isExporting = false,
  isArchiving = false,
  isForceStarting = false,
  isBulkRetrying = false,
  isStoppingSeeding = false,
  isUpdatingProtection = false,
} = {}) {
  return {
    downloading: isDownloading,
    deleting: isDeleting,
    exporting: isExporting,
    archiving: isArchiving,
    forceStarting: isForceStarting,
    bulkRetrying: isBulkRetrying,
    stoppingSeeding: isStoppingSeeding,
    updatingProtection: isUpdatingProtection,
  };
}

export function createBulkActionVisibility({
  showBulkForceStart = false,
  showBulkRetry = false,
  showBulkAirlockLock = false,
  showBulkAirlockUnlock = false,
  showBulkProtect = false,
  showBulkUnprotect = false,
  showBulkStopSeeding = false,
  showBulkArchive = false,
} = {}) {
  return {
    forceStart: showBulkForceStart,
    retry: showBulkRetry,
    airlockLock: showBulkAirlockLock,
    airlockUnlock: showBulkAirlockUnlock,
    protect: showBulkProtect,
    unprotect: showBulkUnprotect,
    stopSeeding: showBulkStopSeeding,
    archive: showBulkArchive,
  };
}

export function createConfirmDialogs({
  showArchiveConfirm = false,
  showDeleteConfirm = false,
  showTagAssignment = false,
} = {}) {
  return {
    archive: showArchiveConfirm,
    delete: showDeleteConfirm,
    tagAssignment: showTagAssignment,
  };
}
