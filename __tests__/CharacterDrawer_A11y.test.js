import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CharacterDrawer from '@/components/CharacterDrawer';
import { useGame } from '@/context/GameContext';

// Mocks similar to original test
jest.mock('@/context/GameContext');
jest.mock('@/lib/firebase', () => ({ db: {}, storage: {} }));
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    doc: jest.fn(),
    writeBatch: jest.fn(),
    getDocs: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    increment: jest.fn(),
    serverTimestamp: jest.fn(),
}));
jest.mock('firebase/storage', () => ({ ref: jest.fn(), deleteObject: jest.fn() }));
jest.mock('@/components/ImageUploader', () => () => <div />);
jest.mock('lucide-react', () => ({
    Shield: () => <div />,
    ChevronDown: () => <div />,
    ChevronUp: () => <div />,
    Edit3: () => <div />,
    Plus: () => <div />,
    X: () => <div />,
    Trash2: () => <div />,
    AlertCircle: () => <div />,
    AlertTriangle: () => <div />,
    Loader: () => <div />,
}));

describe('CharacterDrawer Accessibility', () => {
    const mockUser = { uid: 'u1' };
    const mockCharacters = [
        { id: 'c1', name: 'Hero 1', race: 'Human', class: 'Fighter' },
        { id: 'c2', name: 'Hero 2', race: 'Elf', class: 'Mage' }
    ];
    const mockSetActiveCharId = jest.fn();

    beforeEach(() => {
        useGame.mockReturnValue({
            user: mockUser,
            characters: mockCharacters,
            activeCharId: 'c1',
            setActiveCharId: mockSetActiveCharId,
        });
    });

    test('Drawer toggle is keyboard accessible', () => {
        render(<CharacterDrawer />);
        const toggleBtn = screen.getByRole('button', { name: /Open Character Roster|Close Character Roster/i });

        // Check attributes
        expect(toggleBtn).toHaveAttribute('tabIndex', '0');
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

        // Test Enter key
        fireEvent.keyDown(toggleBtn, { key: 'Enter', code: 'Enter' });
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

        // Test Space key
        fireEvent.keyDown(toggleBtn, { key: ' ', code: 'Space' });
        expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    });

    test('Character list items are keyboard accessible', () => {
        // Render opened drawer
        render(<CharacterDrawer />);
        // Just force open logic if possible, or trigger it
        fireEvent.click(screen.getByText('Character Roster'));

        const charItem = screen.getByText('Hero 2').closest('div[role="button"]');

        expect(charItem).toHaveAttribute('tabIndex', '0');

        // Press Enter to select
        fireEvent.keyDown(charItem, { key: 'Enter' });
        expect(mockSetActiveCharId).toHaveBeenCalledWith('c2');
    });

    test('Interactive elements have appropriate aria-labels', () => {
        render(<CharacterDrawer />);
        fireEvent.click(screen.getByText('Character Roster'));

        // Delete button
        expect(screen.getByLabelText('Delete Character')).toBeInTheDocument();

        // Edit buttons on items
        expect(screen.getByLabelText('Edit Hero 1')).toBeInTheDocument();
        expect(screen.getByLabelText('Edit Hero 2')).toBeInTheDocument();
    });
});
