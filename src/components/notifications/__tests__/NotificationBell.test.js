import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationBell from '../NotificationBell';
import { useNotifications } from '../../shared/hooks/useNotifications';

// Mock the useNotifications hook
jest.mock('../../shared/hooks/useNotifications');

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key) => key,
}));

describe('NotificationBell', () => {
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    useNotifications.mockReturnValue({
      unreadCount: 0,
      loading: false,
      error: null,
      setIsPolling: jest.fn(),
    });
  });

  it('renders notification bell with no unread notifications', () => {
    render(<NotificationBell apiKey={mockApiKey} />);
    
    const bellButton = screen.getByRole('button');
    expect(bellButton).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders notification bell with unread count badge', () => {
    useNotifications.mockReturnValue({
      unreadCount: 5,
      loading: false,
      error: null,
      setIsPolling: jest.fn(),
    });

    render(<NotificationBell apiKey={mockApiKey} />);
    
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows loading spinner when loading', () => {
    useNotifications.mockReturnValue({
      unreadCount: 0,
      loading: true,
      error: null,
      setIsPolling: jest.fn(),
    });

    render(<NotificationBell apiKey={mockApiKey} />);
    
    const bellButton = screen.getByRole('button');
    expect(bellButton).toBeDisabled();
  });

  it('does not render when no API key is provided', () => {
    render(<NotificationBell apiKey={null} />);
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('toggles notification panel when clicked', async () => {
    render(<NotificationBell apiKey={mockApiKey} />);
    
    const bellButton = screen.getByRole('button');
    fireEvent.click(bellButton);
    
    await waitFor(() => {
      expect(screen.getByText('notifications')).toBeInTheDocument();
    });
  });
});
