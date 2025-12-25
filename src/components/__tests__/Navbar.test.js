import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Navbar from '../Navbar';
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
});
