/**
 * SSE user-event helpers for connected frontend clients.
 */

/**
 * @param {string | undefined} actionType
 * @returns {boolean}
 */
export function isTagActionType(actionType) {
  return actionType === 'add_tag' || actionType === 'remove_tag';
}

/**
 * Notify connected clients that download-tag mappings changed.
 * @param {{ eventNotifier?: { notify: (authId: string, payload: object) => void } }} backend
 * @param {string} authId
 */
export function notifyTagsChanged(backend, authId) {
  backend?.eventNotifier?.notify(authId, { event: 'tags_changed' });
}

/**
 * Notify connected clients that download protection changed.
 * @param {{ eventNotifier?: { notify: (authId: string, payload: object) => void } }} backend
 * @param {string} authId
 */
export function notifyProtectionChanged(backend, authId) {
  backend?.eventNotifier?.notify(authId, { event: 'protection_changed' });
}
