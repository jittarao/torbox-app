import { describe, expect, test, mock } from 'bun:test';
import EventNotifier from '../EventNotifier.js';

describe('EventNotifier', () => {
  test('subscribe writes an immediate SSE comment so proxies see bytes', () => {
    const notifier = new EventNotifier();
    const writes = [];
    const res = {
      write: (chunk) => writes.push(chunk),
      on: mock(() => {}),
    };

    notifier.subscribe('auth-1', res);

    expect(writes[0]).toBe(': connected\n\n');
  });

  test('heartbeat writes SSE comment pings', () => {
    const notifier = new EventNotifier();
    const writes = [];
    const res = {
      write: (chunk) => writes.push(chunk),
      on: mock(() => {}),
    };

    notifier.subscribe('auth-1', res);
    notifier.startHeartbeat(10);

    return new Promise((resolve) => {
      setTimeout(() => {
        notifier.stopHeartbeat();
        expect(writes.some((w) => w === ': ping\n\n')).toBe(true);
        resolve();
      }, 25);
    });
  });
});
