import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorComponent from '@/app/error';
import { reloadPage } from '@/lib/navigation';

// Mock the navigation utility
jest.mock('@/lib/navigation', () => ({
    reloadPage: jest.fn(),
}));

describe('Error Boundary Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders generic error message and reset button for standard errors', () => {
        const error = new Error('Something went wrong');
        const reset = jest.fn();

        render(<ErrorComponent error={error} reset={reset} />);

        expect(screen.getByText('Something went wrong!')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();

        const button = screen.getByRole('button');
        fireEvent.click(button);

        expect(reset).toHaveBeenCalled();
        expect(reloadPage).not.toHaveBeenCalled();
    });

    it('renders new version message and reload button for ChunkLoadError', () => {
        const error = new Error('Loading chunk 123 failed');
        error.name = 'ChunkLoadError';
        const reset = jest.fn();

        render(<ErrorComponent error={error} reset={reset} />);

        expect(screen.getByText('Realm Updated')).toBeInTheDocument();
        expect(screen.getByText(/A new version of the realm has been deployed/i)).toBeInTheDocument();
        expect(screen.getByText('Reload Realm')).toBeInTheDocument();

        const button = screen.getByRole('button');
        fireEvent.click(button);

        expect(reloadPage).toHaveBeenCalled();
        expect(reset).not.toHaveBeenCalled();
    });

    it('detects chunk loading error by message content', () => {
        const error = new Error('Loading chunk static/js/123.js failed'); // Standard Webpack error message
        const reset = jest.fn();

        render(<ErrorComponent error={error} reset={reset} />);

        expect(screen.getByText('Realm Updated')).toBeInTheDocument();
    });
});
