import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Navbar from '@/components/Navbar';
import { useGame } from '@/context/GameContext';

// Mock the dependencies
jest.mock('@/context/GameContext', () => ({
  useGame: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  auth: {},
}));

jest.mock('firebase/auth', () => ({
  signOut: jest.fn(),
}));

// Mock ActiveUsers component since we just want to verify it's toggled
jest.mock('@/components/ActiveUsers', () => {
  return function MockActiveUsers({ isOpen, onClose }) {
    return isOpen ? <div data-testid="active-users-modal">Active Users Modal <button onClick={onClose}>Close</button></div> : null;
  };
});

// Mock NotificationBell component
jest.mock('@/components/NotificationBell', () => {
  return function MockNotificationBell() {
    return <div data-testid="notification-bell">Notifications</div>;
  };
});

describe('Navbar Component', () => {
  const mockSetView = jest.fn();
  const mockOnSearch = jest.fn();
  const mockOnToggleChat = jest.fn();
  const mockOnLoginClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login button and hides users button when user is not logged in', () => {
    useGame.mockReturnValue({
      user: null,
      userRole: null,
      logout: jest.fn(),
    });

    render(
      <Navbar
        currentView="map"
        setView={mockSetView}
        onSearch={mockOnSearch}
        onToggleChat={mockOnToggleChat}
        onLoginClick={mockOnLoginClick}
      />
    );

    // Check for Login button
    expect(screen.getByText(/Login/i)).toBeInTheDocument();

    // Check that Active Users button is NOT present
    const usersButton = screen.queryByLabelText('Active Users');
    expect(usersButton).not.toBeInTheDocument();
  });

  it('renders users button and hides login button when user is logged in', () => {
    useGame.mockReturnValue({
      user: { uid: '123', displayName: 'Test User' },
      userRole: 'user',
      logout: jest.fn(),
    });

    render(
      <Navbar
        currentView="map"
        setView={mockSetView}
        onSearch={mockOnSearch}
        onToggleChat={mockOnToggleChat}
        onLoginClick={mockOnLoginClick}
      />
    );

    // Check that Login button is NOT present
    expect(screen.queryByText(/Login/i)).not.toBeInTheDocument();

    // Check for Active Users button
    const usersButton = screen.getByLabelText('Active Users');
    expect(usersButton).toBeInTheDocument();
  });

  it('opens ActiveUsers modal when the button is clicked', () => {
    useGame.mockReturnValue({
      user: { uid: '123', displayName: 'Test User' },
      userRole: 'user',
      logout: jest.fn(),
    });

    render(
      <Navbar
        currentView="map"
        setView={mockSetView}
        onSearch={mockOnSearch}
        onToggleChat={mockOnToggleChat}
        onLoginClick={mockOnLoginClick}
      />
    );

    // Initial state: Modal should not be visible
    expect(screen.queryByTestId('active-users-modal')).not.toBeInTheDocument();

    // Click the button
    const usersButton = screen.getByLabelText('Active Users');
    fireEvent.click(usersButton);

    // Modal should now be visible
    expect(screen.getByTestId('active-users-modal')).toBeInTheDocument();
  });

  describe('Navbar Notification Badge', () => {
    const mockUser = { uid: 'u1', email: 'test@example.com' };
    const defaultProps = {
      currentView: 'map',
      setView: jest.fn(),
      onSearch: jest.fn(),
      onToggleChat: jest.fn(),
      onLoginClick: jest.fn(),
    };

    beforeEach(() => {
      useGame.mockReturnValue({
        user: mockUser,
        userRole: 'user',
        logout: jest.fn(),
      });
    });

    it('shows badge with count when unreadCount > 0', () => {
      render(<Navbar {...defaultProps} unreadCount={5} />);

      // Check for badge text (desktop + mobile)
      const badges = screen.getAllByText('5');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('hides badge when unreadCount is 0', () => {
      render(<Navbar {...defaultProps} unreadCount={0} />);

      // Should NOT be in the document
      const badge = screen.queryByText('0');
      expect(badge).not.toBeInTheDocument();
    });

    it('shows "9+" when unreadCount > 9', () => {
      render(<Navbar {...defaultProps} unreadCount={12} />);

      const badges = screen.getAllByText('9+');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('does not show badge if user is not logged in', () => {
      useGame.mockReturnValue({ user: null, userRole: null, logout: jest.fn() }); // Logout

      render(<Navbar {...defaultProps} unreadCount={5} />);

      // Chat button should mark not be present or different layout
      // The code: {user ? (...) : (Login Button)}
      // So chat toggle button should not exist.
      expect(screen.queryByLabelText('Toggle Chat')).not.toBeInTheDocument();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });
  });
});
