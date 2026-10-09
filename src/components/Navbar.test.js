import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Navbar from '@/components/Navbar';
import { useGame } from '@/context/GameContext';

jest.mock('@/context/GameContext', () => ({
  useGame: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  auth: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), query: jest.fn(), onSnapshot: jest.fn(() => jest.fn()), orderBy: jest.fn(), limit: jest.fn(),
}));

// Mock ActiveUsers component since we just want to verify it's toggled
jest.mock('@/components/ActiveUsers', () => {
  return function MockActiveUsers({ isOpen, onClose }) {
    return isOpen ? <div data-testid="active-users-modal">Active Users Modal <button onClick={onClose}>Close</button></div> : null;
  };
});

jest.mock('@/components/NotificationBell', () => {
  return function MockNotificationBell() {
    return <div data-testid="notification-bell">Notifications</div>;
  };
});

describe('Navbar', () => {
  const props = {
    currentView: 'map',
    setView: jest.fn(),
    onSearch: jest.fn(),
    onToggleChat: jest.fn(),
    onLoginClick: jest.fn(),
  };
  const signedIn = (extra = {}) => useGame.mockReturnValue({
    user: { uid: 'u1', displayName: 'Wanderer', email: 'wanderer@example.com' },
    userRole: 'user',
    logout: jest.fn().mockResolvedValue(),
    ...extra,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    signedIn();
  });

  const tabs = () => within(screen.getByRole('navigation', { name: 'Main' }));

  it('shows the brand and the four main tabs', () => {
    render(<Navbar {...props} />);
    expect(screen.getByRole('button', { name: 'Realm of Allania, go to World Map' })).toBeInTheDocument();
    for (const label of ['World Map', 'Codex', 'Members', 'Search']) {
      expect(tabs().getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(tabs().queryByRole('button', { name: /Forums/ })).not.toBeInTheDocument();
  });

  it('marks World Map active on map, region and thread pages', () => {
    const { rerender } = render(<Navbar {...props} currentView="region" />);
    expect(tabs().getByRole('button', { name: 'World Map' })).toHaveAttribute('aria-current', 'page');
    rerender(<Navbar {...props} currentView="codex_entry" />);
    expect(tabs().getByRole('button', { name: 'Codex' })).toHaveAttribute('aria-current', 'page');
    expect(tabs().getByRole('button', { name: 'World Map' })).not.toHaveAttribute('aria-current');
  });

  it('tabs navigate', () => {
    render(<Navbar {...props} />);
    fireEvent.click(tabs().getByRole('button', { name: 'Codex' }));
    expect(props.setView).toHaveBeenCalledWith('codex');
    fireEvent.click(screen.getByRole('button', { name: 'Realm of Allania, go to World Map' }));
    expect(props.setView).toHaveBeenCalledWith('map');
  });

  it('Members opens the active users panel', () => {
    render(<Navbar {...props} />);
    expect(screen.queryByTestId('active-users-modal')).not.toBeInTheDocument();
    fireEvent.click(tabs().getByRole('button', { name: 'Members' }));
    expect(screen.getByTestId('active-users-modal')).toBeInTheDocument();
  });

  it('Search opens the site search panel and submits the query', () => {
    render(<Navbar {...props} />);
    fireEvent.click(tabs().getByRole('button', { name: 'Search' }));
    const input = screen.getByRole('searchbox', { name: 'Search the whole site' });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'Ember Oath' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(props.onSearch).toHaveBeenCalledWith('Ember Oath');
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
  });

  it('Escape closes the search panel', () => {
    render(<Navbar {...props} />);
    fireEvent.click(tabs().getByRole('button', { name: 'Search' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
  });

  it('account menu shows the player, appearance, legal and sign out', () => {
    const logout = jest.fn().mockResolvedValue();
    signedIn({ logout });
    render(<Navbar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const menu = within(screen.getByRole('menu', { name: 'Account' }));
    expect(menu.getByText('Wanderer')).toBeInTheDocument();
    expect(menu.getByText('wanderer@example.com')).toBeInTheDocument();
    expect(menu.getByRole('button', { name: /mode/ })).toBeInTheDocument(); // ThemeToggle
    expect(menu.queryByRole('menuitem', { name: /Moderation/ })).not.toBeInTheDocument();

    fireEvent.click(menu.getByRole('menuitem', { name: 'Legal and Terms' }));
    expect(props.setView).toHaveBeenCalledWith('legal');

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalled();
  });

  it('account menu switches the welcome page back on', () => {
    const setHideWelcome = jest.fn();
    signedIn({ hideWelcome: true, setHideWelcome });
    render(<Navbar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const item = screen.getByRole('menuitemcheckbox', { name: 'Show welcome page' });
    expect(item).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(item);
    expect(setHideWelcome).toHaveBeenCalledWith(false);
  });

  it('staff get a Moderation link', () => {
    signedIn({ userRole: 'moderator' });
    render(<Navbar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('menuitem', { name: /Moderation/ })).toHaveAttribute('href', '/admin/moderation');
  });

  it('the hamburger menu holds the same items', () => {
    render(<Navbar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    // Tabs appear twice: in the lg+ nav and the menu
    expect(screen.getAllByRole('button', { name: 'Codex' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);
  });

  it('messages button shows the unread count and toggles chat', () => {
    const { rerender } = render(<Navbar {...props} unreadCount={5} />);
    fireEvent.click(screen.getByRole('button', { name: 'Messages, 5 unread' }));
    expect(props.onToggleChat).toHaveBeenCalled();
    rerender(<Navbar {...props} unreadCount={12} />);
    expect(screen.getByText('9+')).toBeInTheDocument();
    rerender(<Navbar {...props} unreadCount={0} />);
    expect(screen.getByRole('button', { name: 'Messages' })).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  describe('signed out', () => {
    beforeEach(() => useGame.mockReturnValue({ user: null, userRole: null, logout: jest.fn() }));

    it('shows Login instead of messages, bell and account menu', () => {
      render(<Navbar {...props} unreadCount={5} />);
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));
      expect(props.onLoginClick).toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: /Messages/ })).not.toBeInTheDocument();
      expect(screen.queryByTestId('notification-bell')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Account menu' })).not.toBeInTheDocument();
    });

    it('Members asks guests to sign in', () => {
      render(<Navbar {...props} />);
      fireEvent.click(tabs().getByRole('button', { name: 'Members' }));
      expect(props.onLoginClick).toHaveBeenCalled();
      expect(screen.queryByTestId('active-users-modal')).not.toBeInTheDocument();
    });
  });
});
