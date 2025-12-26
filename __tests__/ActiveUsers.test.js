import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActiveUsers from '../src/components/ActiveUsers';
import { useGame } from '../src/context/GameContext';
import { onSnapshot } from 'firebase/firestore';

// Mock Dependencies
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    query: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    onSnapshot: jest.fn(),
    getFirestore: jest.fn(),
}));

jest.mock('../src/lib/firebase', () => ({
    db: {}, // Mock db object
}));

jest.mock('../src/context/GameContext', () => ({
    useGame: jest.fn(),
}));

// Mock Constants because of alias issues in tests sometimes, though here we just imported component
// but components usually import constants with @/lib/constants. 
// If jest doesn't handle @ then we might have issues, but let's assume jest.config handles it or we mock it.
// We'll trust the environment first.

describe('ActiveUsers Component', () => {
    const mockUnsubscribe = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        onSnapshot.mockReturnValue(mockUnsubscribe);
        useGame.mockReturnValue({ user: { uid: 'current-user-uid', username: 'CurrentPlayer' } });
    });

    test('renders nothing when not open', () => {
        const { container } = render(<ActiveUsers isOpen={false} onClose={jest.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    test('renders correctly when open with users', async () => {
        // Setup snapshot data
        const mockData = [
            { id: 'user1', data: () => ({ username: 'PlayerOne', lastSeen: { toMillis: () => Date.now() - 1000 } }) },
            { id: 'current-user-uid', data: () => ({ username: 'CurrentPlayer', lastSeen: { toMillis: () => Date.now() - 2000 } }) },
        ];

        onSnapshot.mockImplementation((query, callback) => {
            callback({
                forEach: (fn) => mockData.forEach(fn)
            });
            return mockUnsubscribe;
        });

        render(<ActiveUsers isOpen={true} onClose={jest.fn()} />);

        // Check title
        expect(screen.getByText('Active Users')).toBeInTheDocument();

        // Check users
        expect(screen.getByText('PlayerOne')).toBeInTheDocument();
        expect(screen.getByText('CurrentPlayer')).toBeInTheDocument();

        // Check "You" verification
        expect(screen.getByText('(You)')).toBeInTheDocument();
    });

    test('renders empty state message when no users', () => {
        onSnapshot.mockImplementation((query, callback) => {
            callback({
                forEach: (fn) => [] // No users
            });
            return mockUnsubscribe;
        });

        render(<ActiveUsers isOpen={true} onClose={jest.fn()} />);
        expect(screen.getByText('The realm is quiet...')).toBeInTheDocument();
        expect(screen.getByText('0 souls present in the realm')).toBeInTheDocument();
    });

    test('closes when close button is clicked', () => {
        const onClose = jest.fn();
        onSnapshot.mockImplementation((query, callback) => {
            callback({ forEach: () => { } });
            return mockUnsubscribe;
        });

        render(<ActiveUsers isOpen={true} onClose={onClose} />);

        const closeBtn = screen.getByRole('button'); // The X button is usually the first button or we can find by class if needed
        // Actually there's a button wrapping X. 
        // And there are no other buttons in the mock state effectively (unless users had buttons, which they don't).

        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalled();
    });
});
