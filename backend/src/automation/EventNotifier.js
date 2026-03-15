import logger from '../utils/logger.js';

/**
 * Per-authId SSE notifier. When a user's poll completes with changes, notify connected clients
 * so the frontend can refetch instead of relying only on a fixed 15s poll.
 */
class EventNotifier {
  constructor() {
    /** @type {Map<string, Set<import('express').Response>>} */
    this.connections = new Map();
  }

  /**
   * Subscribe a response to events for the given authId.
   * @param {string} authId
   * @param {import('express').Response} res - Express response (SSE)
   */
  subscribe(authId, res) {
    if (!this.connections.has(authId)) {
      this.connections.set(authId, new Set());
    }
    this.connections.get(authId).add(res);
    res.on('close', () => this.unsubscribe(authId, res));
  }

  /**
   * @param {string} authId
   * @param {import('express').Response} res
   */
  unsubscribe(authId, res) {
    const set = this.connections.get(authId);
    if (set) {
      set.delete(res);
      if (set.size === 0) this.connections.delete(authId);
    }
  }

  /**
   * Notify all connections for this authId (e.g. after poll completed with changes).
   * @param {string} authId
   * @param {object} [payload] - Optional payload; default event is "changed"
   */
  notify(authId, payload = { event: 'changed' }) {
    const set = this.connections.get(authId);
    if (!set || set.size === 0) return;
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    for (const res of set) {
      try {
        res.write(`data: ${data}\n\n`);
      } catch (err) {
        logger.debug('SSE write failed, removing connection', { authId, errorMessage: err.message });
        set.delete(res);
      }
    }
  }
}

export default EventNotifier;
