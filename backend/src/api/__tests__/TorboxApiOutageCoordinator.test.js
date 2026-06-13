import { describe, it, expect, beforeEach, mock } from 'bun:test';
import torboxApiOutageCoordinator from '../TorboxApiOutageCoordinator.js';

describe('TorboxApiOutageCoordinator', () => {
  beforeEach(() => {
    torboxApiOutageCoordinator.resetForTests();
  });

  it('starts in active mode', () => {
    expect(torboxApiOutageCoordinator.isAutomationAllowed()).toBe(true);
  });

  it('pauses after consecutive all-connection-failure cycles', () => {
    torboxApiOutageCoordinator.recordPollCycleResult({
      attempted: 2,
      connectionErrors: 2,
      successes: 0,
    });
    expect(torboxApiOutageCoordinator.isAutomationAllowed()).toBe(true);

    torboxApiOutageCoordinator.recordPollCycleResult({
      attempted: 1,
      connectionErrors: 1,
      successes: 0,
    });
    expect(torboxApiOutageCoordinator.isAutomationAllowed()).toBe(false);
    expect(torboxApiOutageCoordinator.getSnapshot().pauseReason).toBe(
      'consecutive_connection_failures'
    );
  });

  it('resets strikes when a cycle has successes', () => {
    torboxApiOutageCoordinator.recordPollCycleResult({
      attempted: 2,
      connectionErrors: 2,
      successes: 0,
    });
    torboxApiOutageCoordinator.recordPollCycleResult({
      attempted: 1,
      connectionErrors: 0,
      successes: 1,
    });
    torboxApiOutageCoordinator.recordPollCycleResult({
      attempted: 2,
      connectionErrors: 2,
      successes: 0,
    });
    expect(torboxApiOutageCoordinator.isAutomationAllowed()).toBe(true);
    expect(torboxApiOutageCoordinator.getSnapshot().strikes).toBe(1);
  });

  it('notifyCircuitBreakerOpened pauses immediately', () => {
    torboxApiOutageCoordinator.notifyCircuitBreakerOpened();
    expect(torboxApiOutageCoordinator.getSnapshot().pauseReason).toBe('circuit_breaker');
  });

  it('enterPaused is idempotent', () => {
    torboxApiOutageCoordinator.enterPaused('circuit_breaker');
    const firstPausedAt = torboxApiOutageCoordinator.pausedAt;
    torboxApiOutageCoordinator.enterPaused('circuit_breaker');
    expect(torboxApiOutageCoordinator.pausedAt).toBe(firstPausedAt);
  });

  it('does not record poll cycles while paused', () => {
    torboxApiOutageCoordinator.enterPaused('circuit_breaker');
    torboxApiOutageCoordinator.recordPollCycleResult({
      attempted: 5,
      connectionErrors: 5,
      successes: 0,
    });
    expect(torboxApiOutageCoordinator.getSnapshot().strikes).toBe(0);
  });

  it('noteSuccessfulCall dedupes and caps pool', () => {
    torboxApiOutageCoordinator.noteSuccessfulCall('a');
    torboxApiOutageCoordinator.noteSuccessfulCall('b');
    torboxApiOutageCoordinator.noteSuccessfulCall('a');
    expect(torboxApiOutageCoordinator.getSnapshot().recentSuccessPoolSize).toBe(2);
  });

  it('recovery probe resumes and fires callback', async () => {
    let resetCalled = false;
    let recoveryFired = false;

    mock.module('../ApiClient.js', () => ({
      default: class MockApiClient {
        constructor() {}
        async probeUserMe() {
          return { ok: true };
        }
      },
      resetTorboxCircuitBreaker: () => {
        resetCalled = true;
      },
    }));

    torboxApiOutageCoordinator.setDependencies(
      {
        getUserRegistryInfo: (authId) =>
          authId === 'user1' ? { auth_id: 'user1', encrypted_key: 'enc' } : null,
        getActiveUsers: () => [],
      },
      () => 'plain-key'
    );

    torboxApiOutageCoordinator.noteSuccessfulCall('user1');
    torboxApiOutageCoordinator.enterPaused('circuit_breaker');
    torboxApiOutageCoordinator.pausedAt = Date.now() - 130000;

    torboxApiOutageCoordinator.onRecovery(async () => {
      recoveryFired = true;
    });

    await torboxApiOutageCoordinator.runRecoveryProbe();

    expect(torboxApiOutageCoordinator.isAutomationAllowed()).toBe(true);
    expect(resetCalled).toBe(true);
    expect(recoveryFired).toBe(true);

    mock.restore();
  });
});
