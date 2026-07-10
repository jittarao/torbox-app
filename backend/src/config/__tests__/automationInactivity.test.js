import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  DEFAULT_AUTOMATION_INACTIVE_USER_DAYS,
  computeAutomationInactivityCutoff,
  getAutomationInactivityDays,
  INACTIVITY_ELIGIBILITY_SQL,
  INACTIVITY_INELIGIBILITY_SQL,
  isAutomationInactivityFilterEnabled,
  isUserEligibleForAutomation,
} from '../automationInactivity.js';

const ENV_KEY = 'AUTOMATION_INACTIVE_USER_DAYS';

describe('automationInactivity config', () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = process.env[ENV_KEY];
  });

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = savedEnv;
    }
  });

  test('defaults to 30 days', () => {
    delete process.env[ENV_KEY];
    expect(getAutomationInactivityDays()).toBe(DEFAULT_AUTOMATION_INACTIVE_USER_DAYS);
    expect(isAutomationInactivityFilterEnabled()).toBe(true);
  });

  test('respects env override', () => {
    process.env[ENV_KEY] = '14';
    expect(getAutomationInactivityDays()).toBe(14);
  });

  test('invalid env falls back to default', () => {
    process.env[ENV_KEY] = 'not-a-number';
    expect(getAutomationInactivityDays()).toBe(DEFAULT_AUTOMATION_INACTIVE_USER_DAYS);
  });

  test('runtime env mutation is observed on next call', () => {
    process.env[ENV_KEY] = '30';
    expect(getAutomationInactivityDays()).toBe(30);
    expect(computeAutomationInactivityCutoff(Date.parse('2026-07-10T12:00:00.000Z'))).toBe(
      '2026-06-10 12:00:00'
    );

    process.env[ENV_KEY] = '0';
    expect(getAutomationInactivityDays()).toBe(0);
    expect(computeAutomationInactivityCutoff()).toBeNull();
  });

  test('0 disables filtering', () => {
    process.env[ENV_KEY] = '0';
    expect(getAutomationInactivityDays()).toBe(0);
    expect(isAutomationInactivityFilterEnabled()).toBe(false);
    expect(computeAutomationInactivityCutoff()).toBeNull();
  });

  test('computeAutomationInactivityCutoff subtracts days from reference time', () => {
    process.env[ENV_KEY] = '30';
    const referenceMs = Date.parse('2026-07-10T12:00:00.000Z');
    const cutoff = computeAutomationInactivityCutoff(referenceMs);
    expect(cutoff).toBe('2026-06-10 12:00:00');
  });
});

describe('isUserEligibleForAutomation', () => {
  const cutoff = '2026-06-10 12:00:00';

  test('returns true when filter disabled', () => {
    expect(isUserEligibleForAutomation('2020-01-01 00:00:00', null)).toBe(true);
  });

  test('returns true for NULL last_seen_at', () => {
    expect(isUserEligibleForAutomation(null, cutoff)).toBe(true);
    expect(isUserEligibleForAutomation(undefined, cutoff)).toBe(true);
    expect(isUserEligibleForAutomation('', cutoff)).toBe(true);
  });

  test('includes active user within window', () => {
    expect(isUserEligibleForAutomation('2026-07-01 00:00:00', cutoff)).toBe(true);
  });

  test('excludes inactive user before cutoff', () => {
    expect(isUserEligibleForAutomation('2026-06-01 00:00:00', cutoff)).toBe(false);
  });

  test('includes user exactly on cutoff', () => {
    expect(isUserEligibleForAutomation('2026-06-10 12:00:00', cutoff)).toBe(true);
  });

  test('coerces numeric last_seen_at', () => {
    expect(isUserEligibleForAutomation(20260701, cutoff)).toBe(true);
  });

  test('treats whitespace-only last_seen_at as eligible', () => {
    expect(isUserEligibleForAutomation('   ', cutoff)).toBe(true);
  });
});

describe('inactivity SQL constants', () => {
  test('ineligibility SQL complements eligibility SQL', () => {
    expect(INACTIVITY_ELIGIBILITY_SQL).toContain('IS NULL');
    expect(INACTIVITY_INELIGIBILITY_SQL).toContain('IS NOT NULL');
    expect(INACTIVITY_INELIGIBILITY_SQL).toContain('< ?');
  });
});
