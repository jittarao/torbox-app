import { create } from 'zustand';
import adminApiClient from '@/utils/adminApiClient';

/**
 * Admin Store
 * Manages admin panel state and authentication
 */
const useAdminStore = create((set, get) => ({
  // Authentication state
  isAuthenticated: false,
  isAuthenticating: false,
  authError: null,

  // Current user selection
  selectedUser: null,
  selectedUserData: null,

  // Data state
  users: [],
  usersLoading: false,
  usersError: null,
  usersPagination: null,

  // Metrics state
  overviewMetrics: null,
  overviewLoading: false,
  overviewError: null,

  // Filters and search
  userFilters: {
    status: null,
    search: '',
    page: 1,
    limit: 50,
  },

  // ===== Authentication =====

  async authenticate(adminKey) {
    set({ isAuthenticating: true, authError: null });
    try {
      await adminApiClient.authenticate(adminKey);
      set({ isAuthenticated: true, isAuthenticating: false });
      return { success: true };
    } catch (error) {
      set({
        isAuthenticated: false,
        isAuthenticating: false,
        authError: error.message,
      });
      return { success: false, error: error.message };
    }
  },

  async verifyAuth() {
    try {
      await adminApiClient.verify();
      set({ isAuthenticated: true });
      return true;
    } catch (error) {
      set({ isAuthenticated: false });
      return false;
    }
  },

  logout() {
    adminApiClient.clearAdminKey();
    set({
      isAuthenticated: false,
      authError: null,
      selectedUser: null,
      selectedUserData: null,
      users: [],
      overviewMetrics: null,
    });
  },

  // ===== User Management =====

  async fetchUsers(filters = {}) {
    const currentFilters = { ...get().userFilters, ...filters };
    set({ usersLoading: true, usersError: null, userFilters: currentFilters });

    try {
      const response = await adminApiClient.getUsers(currentFilters);
      set({
        users: response.users || [],
        usersPagination: response.pagination || null,
        usersLoading: false,
      });
      return { success: true, data: response };
    } catch (error) {
      set({
        usersError: error.message,
        usersLoading: false,
      });
      return { success: false, error: error.message };
    }
  },

  async fetchUser(authId) {
    set({ selectedUser: authId, selectedUserData: null });
    try {
      const response = await adminApiClient.getUser(authId);
      set({ selectedUserData: response.user });
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async deleteUser(authId) {
    try {
      await adminApiClient.deleteUser(authId);
      // Refresh users list
      await get().fetchUsers();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async updateUserStatus(authId, status) {
    try {
      await adminApiClient.updateUserStatus(authId, status);
      // Refresh users list
      await get().fetchUsers();
      if (get().selectedUser === authId) {
        await get().fetchUser(authId);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // ===== Metrics =====

  async fetchOverviewMetrics() {
    set({ overviewLoading: true, overviewError: null });
    try {
      const response = await adminApiClient.getOverviewMetrics();
      set({
        overviewMetrics: response.overview,
        overviewLoading: false,
      });
      return { success: true, data: response };
    } catch (error) {
      set({
        overviewError: error.message,
        overviewLoading: false,
      });
      return { success: false, error: error.message };
    }
  },

  // ===== Filters =====

  setUserFilter(key, value) {
    const filters = { ...get().userFilters, [key]: value };
    if (key !== 'page') {
      filters.page = 1; // Reset to page 1 when filters change
    }
    set({ userFilters: filters });
  },

  clearUserFilters() {
    set({
      userFilters: {
        status: null,
        search: '',
        page: 1,
        limit: 50,
      },
    });
  },
}));

export default useAdminStore;
