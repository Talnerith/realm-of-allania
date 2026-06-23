import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import LandingPage from '@/components/LandingPage';

describe('LandingPage', () => {
    // Mock localStorage
    const localStorageMock = (function () {
        let store = {};
        return {
            getItem: jest.fn(key => store[key] || null),
            setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
            clear: jest.fn(() => { store = {}; })
        };
    })();

    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    beforeEach(() => {
        window.localStorage.clear();
        jest.clearAllMocks();
    });

    it('renders the main heading and content', () => {
        render(<LandingPage onEnter={jest.fn()} />);
        expect(screen.getByText('Realm of Allania')).toBeInTheDocument();
        expect(screen.getByText(/Play-by-Post Roleplaying experience/i)).toBeInTheDocument();
        expect(screen.getByText('Platform Features')).toBeInTheDocument();
    });

    it('calls onEnter when Enter button is clicked', () => {
        const onEnter = jest.fn();
        render(<LandingPage onEnter={onEnter} />);

        const enterBtn = screen.getByText('Enter the Realm');
        fireEvent.click(enterBtn);

        expect(onEnter).toHaveBeenCalledTimes(1);
    });

    it('sets localStorage when opt-out checkbox is checked', () => {
        const onEnter = jest.fn();
        render(<LandingPage onEnter={onEnter} />);

        const checkbox = screen.getByLabelText("Don't show this introduction again");
        fireEvent.click(checkbox); // Check it

        const enterBtn = screen.getByText('Enter the Realm');
        fireEvent.click(enterBtn);

        expect(window.localStorage.setItem).toHaveBeenCalledWith('skipLanding', 'true');
        expect(onEnter).toHaveBeenCalled();
    });

    it('does not set localStorage if checkbox is unchecked', () => {
        const onEnter = jest.fn();
        render(<LandingPage onEnter={onEnter} />);

        const enterBtn = screen.getByText('Enter the Realm');
        fireEvent.click(enterBtn);

        expect(window.localStorage.setItem).not.toHaveBeenCalled();
        expect(onEnter).toHaveBeenCalled();
    });
});
