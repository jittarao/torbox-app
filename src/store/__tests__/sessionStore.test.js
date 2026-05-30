import { describe, expect, test, beforeEach, mock } from 'bun:test';

function mockStoreWithSetApiKey(realStore) {
  const realGetState = realStore.getState.bind(realStore);
  const wrapped = (selector) => realStore(selector);
  wrapped.getState = () => ({
    ...realGetState(),
    setApiKey: mock(() => {}),
  });
  wrapped.setState = realStore.setState;
  wrapped.subscribe = realStore.subscribe;
  return wrapped;
}

const { useNotificationsStore: realNotificationsStore } = await import('../notificationsStore.js');

mock.module('@/store/tagsStore', () => ({
  useTagsStore: { getState: () => ({ setApiKey: mock(() => {}) }) },
}));
mock.module('@/store/downloadTagsStore', () => ({
  useDownloadTagsStore: { getState: () => ({ setApiKey: mock(() => {}) }) },
}));
mock.module('@/store/customViewsStore', () => ({
  useCustomViewsStore: { getState: () => ({ setApiKey: mock(() => {}) }) },
}));
mock.module('@/store/automationRulesStore', () => ({
  useAutomationRulesStore: { getState: () => ({ setApiKey: mock(() => {}) }) },
}));
mock.module('@/store/notificationsStore', () => ({
  useNotificationsStore: mockStoreWithSetApiKey(realNotificationsStore),
}));
mock.module('@/store/healthStore', () => ({
  useHealthStore: { getState: () => ({ setApiKey: mock(() => {}) }) },
}));
mock.module('@/store/rssStore', () => ({
  useRssStore: { getState: () => ({ setApiKey: mock(() => {}) }) },
}));
mock.module('@/utils/userProfile', () => ({
  fetchUserProfile: mock(async () => ({ plan: 2 })),
  getUserPermissions: mock(() => ({ planId: 2 })),
}));

const { useSessionStore } = await import('../sessionStore.js');

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      apiKey: '',
      hydrated: false,
      permissions: null,
      permissionsLoading: false,
    });
  });

  test('setApiKey rejects invalid keys', () => {
    useSessionStore.getState().setApiKey('short');
    expect(useSessionStore.getState().apiKey).toBe('');
  });

  test('syncApiKey updates apiKey and marks hydrated', () => {
    const validKey = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    useSessionStore.getState().syncApiKey(validKey);
    expect(useSessionStore.getState().apiKey).toBe(validKey);
    expect(useSessionStore.getState().hydrated).toBe(true);
  });

  test('setApiKey clears permissions until reload completes', () => {
    const keyA = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const keyB = 'bbbbbbbb-bbbb-cccc-dddd-ffffffffffff';
    useSessionStore.setState({
      apiKey: keyA,
      hydrated: true,
      permissions: { planId: 2 },
      permissionsLoading: false,
    });

    useSessionStore.getState().setApiKey(keyB);

    expect(useSessionStore.getState().apiKey).toBe(keyB);
    expect(useSessionStore.getState().permissions).toBe(null);
    expect(useSessionStore.getState().permissionsLoading).toBe(true);
  });
});
