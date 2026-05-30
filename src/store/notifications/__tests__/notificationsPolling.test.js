import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { useNotificationsStore } from '@/store/notificationsStore';

describe('notifications polling ref-count', () => {
  beforeEach(() => {
    const { pollTimerId } = useNotificationsStore.getState();
    if (pollTimerId) clearInterval(pollTimerId);
    useNotificationsStore.setState({
      pollSubscribers: 0,
      pollTimerId: null,
      currentApiKey: null,
    });
  });

  afterEach(() => {
    const { pollTimerId } = useNotificationsStore.getState();
    if (pollTimerId) clearInterval(pollTimerId);
    useNotificationsStore.setState({ pollSubscribers: 0, pollTimerId: null });
  });

  test('two subscribers share one timer; stop clears when last unsubscribes', () => {
    const store = useNotificationsStore.getState();
    store.startNotificationsPolling('key-a');
    const afterFirst = useNotificationsStore.getState();
    expect(afterFirst.pollSubscribers).toBe(1);
    expect(afterFirst.pollTimerId).not.toBeNull();

    store.startNotificationsPolling('key-a');
    const afterSecond = useNotificationsStore.getState();
    expect(afterSecond.pollSubscribers).toBe(2);
    expect(afterSecond.pollTimerId).toBe(afterFirst.pollTimerId);

    useNotificationsStore.getState().stopNotificationsPolling();
    expect(useNotificationsStore.getState().pollSubscribers).toBe(1);
    expect(useNotificationsStore.getState().pollTimerId).not.toBeNull();

    useNotificationsStore.getState().stopNotificationsPolling();
    const afterStop = useNotificationsStore.getState();
    expect(afterStop.pollSubscribers).toBe(0);
    expect(afterStop.pollTimerId).toBeNull();
  });
});
