import { create } from 'zustand';

// Maximum number of files to upload
const MAX_FILES = 50;

export const useUploaderStore = create((set, get) => ({
  items: [],
  error: '',
  isUploading: false,
  progress: { current: 0, total: 0 },

  // Actions
  setItems: (items) => set({ items }),
  addItems: (newItems) => {
    const queuedCount = get().items.reduce(
      (count, item) => (item.status === 'queued' ? count + 1 : count),
      0,
    );

    if (queuedCount + newItems.length > MAX_FILES) {
      set({ error: `Maximum ${MAX_FILES} items allowed` });
      return;
    }

    set((state) => ({
      items: [...state.items, ...newItems],
      error: '',
    }));
  },
  removeItem: (index) =>
    set((state) => ({
      items: state.items.filter((_, i) => i !== index),
    })),
  updateItemStatus: (index, status, error = null) =>
    set((state) => {
      const newItems = [...state.items];
      newItems[index] = {
        ...newItems[index],
        status,
        ...(error && { error }),
      };
      return { items: newItems };
    }),
  setError: (error) => set({ error }),
  setIsUploading: (isUploading) => set({ isUploading }),
  setProgress: (progress) => set({ progress }),
  resetUploader: () =>
    set({
      items: [],
      error: '',
      progress: { current: 0, total: 0 },
    }),
}));
