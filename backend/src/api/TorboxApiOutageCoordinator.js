import logger from '../utils/logger.js';

const CYCLES_BEFORE_PAUSE = Math.max(
  1,
  parseInt(process.env.TORBOX_OUTAGE_CYCLES_BEFORE_PAUSE || '2', 10)
);
const MIN_PAUSE_MS = Math.max(0, parseInt(process.env.TORBOX_MIN_PAUSE_MS || '120000', 10));
const RECOVERY_INTERVAL_MS = Math.max(
  10000,
  parseInt(process.env.TORBOX_OUTAGE_RECOVERY_INTERVAL_MS || '180000', 10)
);
const MAX_KEY_ATTEMPTS = Math.max(
  1,
  parseInt(process.env.TORBOX_PROBE_MAX_KEY_ATTEMPTS || '3', 10)
);
const RECENT_SUCCESS_MEMORY_SIZE = Math.max(
  1,
  parseInt(process.env.TORBOX_RECENT_SUCCESS_MEMORY_SIZE || '8', 10)
);

/**
 * Single authority for platform-wide TorBox API availability (automation pause/resume).
 */
class TorboxApiOutageCoordinator {
  constructor() {
    this.mode = 'active';
    this.pauseReason = null;
    this.strikes = 0;
    this.pausedAt = null;
    this.lastProbeAt = null;
    this.lastProbeError = null;
    this._recoveryTimerId = null;
    this._recoveryInFlight = false;
    this._recentSuccessAuthIds = [];
    this._masterDb = null;
    this._decrypt = null;
    this._onRecoveryCallback = null;
  }

  /**
   * @param {import('../database/Database.js').default} masterDb
   * @param {(encrypted: string) => string} decryptFn
   */
  setDependencies(masterDb, decryptFn) {
    this._masterDb = masterDb;
    this._decrypt = decryptFn;
  }

  /**
   * Register a single recovery handler (replaces any previous handler).
   * @param {() => void | Promise<void>} fn
   */
  onRecovery(fn) {
    this._onRecoveryCallback = typeof fn === 'function' ? fn : null;
  }

  isAutomationAllowed() {
    return this.mode === 'active';
  }

  noteSuccessfulCall(authId) {
    if (!authId) return;
    const filtered = this._recentSuccessAuthIds.filter((id) => id !== authId);
    filtered.unshift(authId);
    this._recentSuccessAuthIds = filtered.slice(0, RECENT_SUCCESS_MEMORY_SIZE);
  }

  /**
   * @param {{ attempted: number, connectionErrors: number, successes: number }} result
   */
  recordPollCycleResult(result) {
    if (this.mode !== 'active') return;

    const { attempted = 0, connectionErrors = 0, successes = 0 } = result;
    if (attempted === 0) return;

    if (successes > 0) {
      this.strikes = 0;
      return;
    }

    if (connectionErrors === attempted) {
      this.strikes += 1;
      if (this.strikes >= CYCLES_BEFORE_PAUSE) {
        this.enterPaused('consecutive_connection_failures');
      }
    }
  }

  notifyCircuitBreakerOpened() {
    this.enterPaused('circuit_breaker');
  }

  /**
   * @param {string} reason
   */
  enterPaused(reason) {
    if (this.mode === 'paused') return;

    this.mode = 'paused';
    this.pauseReason = reason;
    this.pausedAt = Date.now();
    this.strikes = 0;

    logger.warn('TorBox API automation paused', {
      reason,
      minPauseMs: MIN_PAUSE_MS,
      recoveryIntervalMs: RECOVERY_INTERVAL_MS,
    });

    this._scheduleRecoveryProbe();
  }

  enterActive() {
    if (this.mode === 'active') return;

    this.mode = 'active';
    this.pauseReason = null;
    this.pausedAt = null;
    this.strikes = 0;
    this.lastProbeError = null;
    this._clearRecoveryTimer();

    logger.info('TorBox API recovered — automation resumed');
  }

  getSnapshot() {
    return {
      mode: this.mode,
      automationPaused: this.mode === 'paused',
      pauseReason: this.pauseReason,
      strikes: this.strikes,
      pausedAt: this.pausedAt ? new Date(this.pausedAt).toISOString() : null,
      lastProbeAt: this.lastProbeAt ? new Date(this.lastProbeAt).toISOString() : null,
      lastProbeError: this.lastProbeError,
      recentSuccessPoolSize: this._recentSuccessAuthIds.length,
      minPauseMs: MIN_PAUSE_MS,
      recoveryIntervalMs: RECOVERY_INTERVAL_MS,
    };
  }

  stop() {
    this._clearRecoveryTimer();
  }

  /** Reset singleton state (tests only). */
  resetForTests() {
    this.stop();
    this.mode = 'active';
    this.pauseReason = null;
    this.strikes = 0;
    this.pausedAt = null;
    this.lastProbeAt = null;
    this.lastProbeError = null;
    this._recoveryInFlight = false;
    this._recentSuccessAuthIds = [];
    this._onRecoveryCallback = null;
    this._masterDb = null;
    this._decrypt = null;
  }

  _clearRecoveryTimer() {
    if (this._recoveryTimerId != null) {
      clearTimeout(this._recoveryTimerId);
      this._recoveryTimerId = null;
    }
  }

  _scheduleRecoveryProbe() {
    if (this.mode !== 'paused') return;

    this._clearRecoveryTimer();

    const elapsed = this.pausedAt != null ? Date.now() - this.pausedAt : 0;
    const untilMinPause = Math.max(0, MIN_PAUSE_MS - elapsed);
    const delayMs = untilMinPause > 0 ? untilMinPause : RECOVERY_INTERVAL_MS;

    this._recoveryTimerId = setTimeout(() => {
      this._recoveryTimerId = null;
      this.runRecoveryProbe().catch((err) => {
        logger.error('Recovery probe failed unexpectedly', err, {
          errorMessage: err.message,
        });
      });
    }, delayMs);
  }

  /**
   * Build ordered auth_id list for probe attempts (shuffled recent + DB fallback).
   * @returns {string[]}
   */
  _pickProbeAuthIds() {
    const fromMemory = [...this._recentSuccessAuthIds];
    for (let i = fromMemory.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fromMemory[i], fromMemory[j]] = [fromMemory[j], fromMemory[i]];
    }

    const seen = new Set(fromMemory);
    const merged = [...fromMemory];

    if (this._masterDb?.getActiveUsers) {
      const active = this._masterDb.getActiveUsers();
      for (const user of active) {
        const id = user?.auth_id;
        if (id && user?.encrypted_key && !seen.has(id)) {
          seen.add(id);
          merged.push(id);
        }
      }
    }

    return merged;
  }

  async runRecoveryProbe() {
    if (this.mode !== 'paused' || this._recoveryInFlight) {
      if (this.mode === 'paused') {
        this._scheduleRecoveryProbe();
      }
      return;
    }

    if (this.pausedAt != null && Date.now() - this.pausedAt < MIN_PAUSE_MS) {
      this._scheduleRecoveryProbe();
      return;
    }

    if (!this._masterDb || !this._decrypt) {
      logger.warn('Recovery probe skipped — coordinator dependencies not set');
      this._scheduleRecoveryProbe();
      return;
    }

    this._recoveryInFlight = true;
    this.lastProbeAt = Date.now();

    try {
      const { default: ApiClient, resetTorboxCircuitBreaker } = await import('./ApiClient.js');
      const authIds = this._pickProbeAuthIds();
      const toTry = authIds.slice(0, MAX_KEY_ATTEMPTS);

      if (toTry.length === 0) {
        this.lastProbeError = 'no_probe_candidates';
        logger.warn('Recovery probe: no API key candidates available');
        return;
      }

      let lastKind = null;
      let authOnly = true;

      for (const authId of toTry) {
        const userInfo = this._masterDb.getUserRegistryInfo(authId);
        if (!userInfo?.encrypted_key) continue;

        let apiKey;
        try {
          apiKey = this._decrypt(userInfo.encrypted_key);
        } catch (decryptErr) {
          logger.warn('Recovery probe: could not decrypt key', {
            authId,
            errorMessage: decryptErr.message,
          });
          continue;
        }

        const client = new ApiClient(apiKey, { authId });
        const probeResult = await client.probeUserMe();

        if (probeResult.ok) {
          this.enterActive();
          resetTorboxCircuitBreaker();
          await this._fireRecoveryCallbacks();
          return;
        }

        lastKind = probeResult.kind;
        if (probeResult.kind !== 'auth') {
          authOnly = false;
        }
      }

      this.lastProbeError = lastKind || 'probe_failed';
      if (authOnly && lastKind === 'auth') {
        logger.warn('Recovery probe: all candidate keys failed authentication', {
          attemptedKeys: toTry.length,
        });
      } else {
        logger.warn('Recovery probe: TorBox API still unreachable', {
          attemptedKeys: toTry.length,
          lastKind,
        });
      }
    } finally {
      this._recoveryInFlight = false;
      if (this.mode === 'paused') {
        this._scheduleRecoveryProbe();
      }
    }
  }

  async _fireRecoveryCallbacks() {
    const fn = this._onRecoveryCallback;
    if (!fn) return;
    try {
      await fn();
    } catch (err) {
      logger.error('onRecovery callback failed', err, { errorMessage: err.message });
    }
  }
}

const torboxApiOutageCoordinator = new TorboxApiOutageCoordinator();

export default torboxApiOutageCoordinator;
