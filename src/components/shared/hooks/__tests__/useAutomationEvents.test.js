import { describe, expect, test } from 'bun:test';
import { parseAutomationSseEvent } from '../useAutomationEvents';

describe('parseAutomationSseEvent', () => {
  test('parses tags_changed events', () => {
    expect(parseAutomationSseEvent('data: {"event":"tags_changed"}')).toBe('tags_changed');
  });

  test('parses protection_changed events', () => {
    expect(parseAutomationSseEvent('data: {"event":"protection_changed"}')).toBe(
      'protection_changed'
    );
  });

  test('ignores download list and legacy events', () => {
    expect(parseAutomationSseEvent('data: {"event":"downloads_changed"}')).toBe(null);
    expect(parseAutomationSseEvent('data: {"event":"changed"}')).toBe(null);
    expect(parseAutomationSseEvent('data: changed')).toBe(null);
  });

  test('ignores comment and empty lines', () => {
    expect(parseAutomationSseEvent(': ping')).toBe(null);
    expect(parseAutomationSseEvent('data:')).toBe(null);
    expect(parseAutomationSseEvent('event: message')).toBe(null);
  });

  test('ignores unknown JSON event types', () => {
    expect(parseAutomationSseEvent('data: {"event":"other"}')).toBe(null);
  });
});
