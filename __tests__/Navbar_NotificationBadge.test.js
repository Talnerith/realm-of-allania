import React from 'react';
import { render, screen } from '@testing-library/react';
import Navbar from '../src/components/Navbar';
import { useGame } from '../src/context/GameContext';

// Mock context
jest.mock('../src/context/GameContext', () => ({
    useGame: jest.fn(),
}));

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
        useGame.mockReturnValue({ user: null }); // Logout

        render(<Navbar {...defaultProps} unreadCount={5} />);

        // Chat button should mark not be present or different layout
        // The code: {user ? (...) : (Login Button)}
        // So chat toggle button should not exist.
        expect(screen.queryByLabelText('Toggle Chat')).not.toBeInTheDocument();
        expect(screen.queryByText('5')).not.toBeInTheDocument();
    });
});
