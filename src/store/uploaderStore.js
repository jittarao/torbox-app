import { create } from 'zustand';

export const useUploaderStore = create((set, get) => ({
  items: [],
  error: '',
  isUploading: false,
  progress: { current: 0, total: 0 },

  // Actions
  setItems: (items) => set({ items }),
  addItems: (newItems) => {
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
