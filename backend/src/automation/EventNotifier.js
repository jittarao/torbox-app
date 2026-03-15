import logger from '../utils/logger.js';

/**
 * Per-authId SSE notifier. When a user's poll completes with changes, notify connected clients
 * so the frontend can refetch instead of relying only on a fixed 15s poll.
 */
class EventNotifier {
  constructor() {
    /** @type {Map<string, Set<import('express').Response>>} */
    this.connections = new Map();
    /** @type {ReturnType<typeof setInterval>|null} */
    this._heartbeatId = null;
  }

  /**
   * Start optional SSE heartbeat to keep connections alive behind proxies/load balancers.
   * @param {number} [intervalMs] - Interval in ms (default 25000). Env: SSE_HEARTBEAT_INTERVAL_MS
   */
  startHeartbeat(intervalMs) {
    if (this._heartbeatId) return;
    const ms =
      intervalMs ??
      parseInt(process.env.SSE_HEARTBEAT_INTERVAL_MS || '25000', 10);
    this._heartbeatId = setInterval(() => {
      for (const [authId, set] of this.connections) {
        for (const res of set) {
          try {
            res.write(': ping\n\n');
          } catch (err) {
            logger.debug('SSE heartbeat write failed, removing connection', {
              authId,
              errorMessage: err.message,
            });
            set.delete(res);
            if (set.size === 0) this.connections.delete(authId);
          }
        }
      }
    }, ms);
  }

  /**
   * Stop the SSE heartbeat timer.
   */
  stopHeartbeat() {
    if (this._heartbeatId) {
      clearInterval(this._heartbeatId);
      this._heartbeatId = null;
    }
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
