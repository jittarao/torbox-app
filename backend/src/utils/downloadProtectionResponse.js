import {
  DOWNLOAD_PROTECTED_CODE,
  DOWNLOAD_PROTECTED_MESSAGE,
  DownloadProtectedError,
} from '../services/DownloadProtectionService.js';

/**
 * @param {import('express').Response} res
 * @param {DownloadProtectedError | string[]} errorOrBlockedIds
 */
export function respondDownloadProtected(res, errorOrBlockedIds) {
  const blockedIds = Array.isArray(errorOrBlockedIds)
    ? errorOrBlockedIds
    : errorOrBlockedIds.blockedIds;

  return res.status(403).json({
    success: false,
    error: DOWNLOAD_PROTECTED_MESSAGE,
    code: DOWNLOAD_PROTECTED_CODE,
    blocked_ids: blockedIds,
  });
}
