import { describe, expect, test } from 'bun:test';
import { getUserPresenceSnapshot, useUserPresenceStore } from '@/store/userPresenceStore';

describe('userPresenceStore snapshot', () => {
  test('isDisengaged reflects visibility, idle, and desktop state', () => {
    useUserPresenceStore.setState({
      isVisible: true,
      isUserIdle: false,
      desktopDisengaged: false,
      awaySince: null,
      wasDisengaged: false,
    });

    expect(getUserPresenceSnapshot().isDisengaged()).toBe(false);

    useUserPresenceStore.setState({ isVisible: false });
    expect(getUserPresenceSnapshot().isDisengaged()).toBe(true);

    useUserPresenceStore.setState({ isVisible: true, isUserIdle: true });
    expect(getUserPresenceSnapshot().isDisengaged()).toBe(true);

    useUserPresenceStore.setState({ isUserIdle: false, desktopDisengaged: true });
    expect(getUserPresenceSnapshot().isDisengaged()).toBe(true);
  });

  test('notifyReEngaged and notifyDisengaged invoke subscribers', () => {
    let reEngaged = 0;
    let disengaged = 0;
    const unsubRe = useUserPresenceStore.getState().subscribeReEngaged(() => {
      reEngaged += 1;
    });
    const unsubDis = useUserPresenceStore.getState().subscribeDisengaged(() => {
      disengaged += 1;
    });

    useUserPresenceStore.getState().notifyReEngaged(true);
    useUserPresenceStore.getState().notifyDisengaged();

    expect(reEngaged).toBe(1);
    expect(disengaged).toBe(1);

    unsubRe();
    unsubDis();
  });
});
