import { describe, expect, test, mock } from 'bun:test';
import { isTagActionType, notifyTagsChanged } from '../userEvents.js';

describe('userEvents', () => {
  test('isTagActionType identifies tag mutation actions', () => {
    expect(isTagActionType('add_tag')).toBe(true);
    expect(isTagActionType('remove_tag')).toBe(true);
    expect(isTagActionType('delete')).toBe(false);
    expect(isTagActionType(undefined)).toBe(false);
  });

  test('notifyTagsChanged sends tags_changed payload', () => {
    const notify = mock(() => {});
    notifyTagsChanged({ eventNotifier: { notify } }, 'auth-1');
    expect(notify).toHaveBeenCalledWith('auth-1', { event: 'tags_changed' });
  });

  test('notifyTagsChanged no-ops without eventNotifier', () => {
    expect(() => notifyTagsChanged({}, 'auth-1')).not.toThrow();
    expect(() => notifyTagsChanged(null, 'auth-1')).not.toThrow();
  });
});
