import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
// We need to mock module resolution or use relative paths if aliases aren't set up in jest
// jest.config.mjs showed moduleNameMapper: '^@/(.*)$': '<rootDir>/src/$1', so this should work.
import AuthScreen from '@/components/AuthScreen';
import { useGame } from '@/context/GameContext';

// Mock the context
jest.mock('@/context/GameContext', () => ({
    useGame: jest.fn(),
}));

describe('AuthScreen Password Toggle', () => {
    beforeEach(() => {
        // Default mock implementation
        useGame.mockReturnValue({
            user: null,
            login: jest.fn(),
            signup: jest.fn(),
            resendVerification: jest.fn(),
            logout: jest.fn(),
            resetPassword: jest.fn()
        });
    });

    it('toggles password visibility correctly', () => {
        render(<AuthScreen />);

        // Find input (by placeholder)
        const passwordInput = screen.getByPlaceholderText('Password');

        // Find toggle button (by aria-label initial state)
        // Note: aria-label is "Show password" initially
        const toggleButton = screen.getByLabelText('Show password');

        // 1. Initial state: type="password"
        expect(passwordInput).toHaveAttribute('type', 'password');

        // 2. Click to show
        fireEvent.click(toggleButton);

        // 3. Check state: type="text"
        expect(passwordInput).toHaveAttribute('type', 'text');

        // Toggle button label should change
        expect(screen.getByLabelText('Hide password')).toBeInTheDocument();

        // 4. Click to hide (find by new label)
        const hideButton = screen.getByLabelText('Hide password');
        fireEvent.click(hideButton);

        // 5. Check state: type="password"
        expect(passwordInput).toHaveAttribute('type', 'password');
        expect(screen.getByLabelText('Show password')).toBeInTheDocument();
    });
});
