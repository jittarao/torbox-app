import { describe, expect, test } from 'bun:test';
import { create } from 'zustand';
import { createApiKeyScopedSlice } from '../createApiKeyScopedStore.js';

describe('createApiKeyScopedSlice', () => {
  const useTestStore = create((set, get) => ({
    value: null,
    ...createApiKeyScopedSlice(set, get, { value: null }),
    setValue: (value) => set({ value }),
  }));

  test('invalidates in-flight requests when api key changes', () => {
    const store = useTestStore.getState();
    store.setApiKey('key-a');
    const requestId = useTestStore.getState().activeRequestId + 1;
    useTestStore.setState({ activeRequestId: requestId });
    expect(useTestStore.getState().isRequestCurrent('key-a', requestId)).toBe(true);

    store.setApiKey('key-b');
    expect(useTestStore.getState().isRequestCurrent('key-a', requestId)).toBe(false);
    expect(useTestStore.getState().currentApiKey).toBe('key-b');
  });
});
