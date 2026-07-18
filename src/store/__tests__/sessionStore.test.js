import { describe, expect, test, beforeEach, afterEach, afterAll, mock } from 'bun:test';

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
const realTagsStore = await import('../tagsStore.js');
const realDownloadTagsStore = await import('../downloadTagsStore.js');
const realProtectedDownloadsStore = await import('../protectedDownloadsStore.js');
const realCustomViewsStore = await import('../customViewsStore.js');
const realAutomationRulesStore = await import('../automationRulesStore.js');
const realHealthStore = await import('../healthStore.js');
const realRssStore = await import('../rssStore.js');
const realUserProfile = await import('@/utils/userProfile');

const mockedModuleRestores = [
  ['@/store/tagsStore', realTagsStore],
  ['@/store/downloadTagsStore', realDownloadTagsStore],
  ['@/store/protectedDownloadsStore', realProtectedDownloadsStore],
  ['@/store/customViewsStore', realCustomViewsStore],
  ['@/store/automationRulesStore', realAutomationRulesStore],
  ['@/store/notificationsStore', { useNotificationsStore: realNotificationsStore }],
  ['@/store/healthStore', realHealthStore],
  ['@/store/rssStore', realRssStore],
  ['@/utils/userProfile', realUserProfile],
];

function applySessionStoreMocks() {
  mock.module('@/store/tagsStore', () => ({
    useTagsStore: { getState: () => ({ setApiKey: mock(() => {}) }) },
  }));
  mock.module('@/store/downloadTagsStore', () => ({
    useDownloadTagsStore: { getState: () => ({ setApiKey: mock(() => {}) }) },
  }));
  mock.module('@/store/protectedDownloadsStore', () => ({
    useProtectedDownloadsStore: { getState: () => ({ setApiKey: mock(() => {}) }) },
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
}

function restoreSessionStoreMocks() {
  for (const [modulePath, moduleExports] of mockedModuleRestores) {
    mock.module(modulePath, () => moduleExports);
  }
}

describe('sessionStore', () => {
  let useSessionStore;

  beforeEach(async () => {
    applySessionStoreMocks();
    ({ useSessionStore } = await import('../sessionStore.js'));
    useSessionStore.setState({
      apiKey: '',
      hydrated: false,
      permissions: null,
      permissionsLoading: false,
    });
  });

  afterEach(() => {
    mock.restore();
  });

  afterAll(() => {
    restoreSessionStoreMocks();
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
