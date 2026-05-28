import { describe, expect, test, beforeEach, mock } from 'bun:test';

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
  useNotificationsStore: { getState: () => ({ setApiKey: mock(() => {}) }) },
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
});
