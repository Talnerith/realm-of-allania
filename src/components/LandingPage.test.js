import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import LandingPage from '@/components/LandingPage';
import { useGame } from '@/context/GameContext';
import { useSiteStats } from '@/lib/siteStats';

jest.mock('@/context/GameContext', () => ({ useGame: jest.fn() }));
jest.mock('@/lib/siteStats', () => ({
    useSiteStats: jest.fn(),
    formatStat: jest.requireActual('@/lib/siteStats').formatStat,
}));

describe('LandingPage', () => {
    const setHideWelcome = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        useGame.mockReturnValue({ user: { uid: 'u1', displayName: 'Wanderer' }, setHideWelcome });
        useSiteStats.mockReturnValue({ members: 1243, posts: 15382, characters: 312, regions: 12 });
    });

    it('shows the hero, welcome line and both calls to action', () => {
        render(<LandingPage onEnter={jest.fn()} onNavigate={jest.fn()} />);
        expect(screen.getByRole('heading', { level: 1, name: 'Realm of Allania' })).toBeInTheDocument();
        expect(screen.getByText('Welcome back, Wanderer.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Enter the World Map/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Explore the Codex/ })).toBeInTheDocument();
    });

    it('Enter goes to the map and Explore opens the Codex', () => {
        const onEnter = jest.fn();
        const onNavigate = jest.fn();
        render(<LandingPage onEnter={onEnter} onNavigate={onNavigate} />);
        fireEvent.click(screen.getByRole('button', { name: /Enter the World Map/ }));
        expect(onEnter).toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /Explore the Codex/ }));
        expect(onNavigate).toHaveBeenCalledWith('codex');
    });

    it('shows the site stats from real data', () => {
        render(<LandingPage onEnter={jest.fn()} />);
        expect(screen.getByText('1,243')).toBeInTheDocument();
        expect(screen.getByText('15,000+')).toBeInTheDocument();
        expect(screen.getByText('312')).toBeInTheDocument();
        expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('hides the stats until they have been counted', () => {
        useSiteStats.mockReturnValue(null);
        render(<LandingPage onEnter={jest.fn()} />);
        expect(screen.queryByText('Members')).not.toBeInTheDocument();
    });

    it('"Don\'t show this again" saves the choice on the account and this device', () => {
        render(<LandingPage onEnter={jest.fn()} />);
        fireEvent.click(screen.getByLabelText("Don't show this again"));
        expect(setHideWelcome).toHaveBeenCalledWith(true);
        expect(localStorage.getItem('skipLanding')).toBe('true');
        expect(screen.getByText(/Turn it back on from your account menu/)).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText("Don't show this again"));
        expect(setHideWelcome).toHaveBeenLastCalledWith(false);
        expect(localStorage.getItem('skipLanding')).toBeNull();
    });

    it('guests keep the choice on this device only', () => {
        useGame.mockReturnValue({ user: null, setHideWelcome });
        render(<LandingPage onEnter={jest.fn()} />);
        expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByLabelText("Don't show this again"));
        expect(setHideWelcome).not.toHaveBeenCalled();
        expect(localStorage.getItem('skipLanding')).toBe('true');
    });

    it('lists the features and the four steps', () => {
        render(<LandingPage onEnter={jest.fn()} />);
        expect(screen.getByRole('button', { name: /Write Together/ })).toBeInTheDocument();
        const steps = within(screen.getByRole('list'));
        expect(steps.getAllByRole('listitem')).toHaveLength(4);
        expect(screen.getByAltText('Step 4')).toBeInTheDocument();
    });
});
