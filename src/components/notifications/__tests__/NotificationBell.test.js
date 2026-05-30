import { describe, it, expect, beforeEach, mock } from 'bun:test';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let mockNotificationsState = {
  unreadCount: 0,
  loading: false,
  error: null,
  setIsPolling: () => {},
};

mock.module('../../shared/hooks/useNotifications', () => ({
  useNotifications: () => mockNotificationsState,
}));

mock.module('next-intl', () => ({
  useTranslations: () => (key) => key,
}));

const { default: NotificationBell } = await import('../NotificationBell');

describe('NotificationBell', () => {
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    mockNotificationsState = {
      unreadCount: 0,
      loading: false,
      error: null,
      setIsPolling: () => {},
    };
  });

  it('renders notification bell with no unread notifications', () => {
    render(<NotificationBell apiKey={mockApiKey} />);

    const bellButton = screen.getByRole('button');
    expect(bellButton).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('renders notification bell with unread count badge', () => {
    mockNotificationsState = {
      ...mockNotificationsState,
      unreadCount: 5,
    };

    render(<NotificationBell apiKey={mockApiKey} />);

    expect(screen.getByText('5')).toBeTruthy();
  });

  it('shows loading spinner when loading', () => {
    mockNotificationsState = {
      ...mockNotificationsState,
      loading: true,
    };

    render(<NotificationBell apiKey={mockApiKey} />);

    const bellButton = screen.getByRole('button');
    expect(bellButton.disabled).toBe(true);
  });

  it('does not render when no API key is provided', () => {
    render(<NotificationBell apiKey={null} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('toggles notification panel when clicked', async () => {
    render(<NotificationBell apiKey={mockApiKey} />);

    const bellButton = screen.getByRole('button');
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText('notifications')).toBeTruthy();
    });
  });
});
