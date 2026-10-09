import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PostItem from '@/components/Forum/PostItem';

jest.mock('@/components/MarkdownEditor', () => {
    const MockMarkdownEditor = () => <div data-testid="markdown-editor">Editor</div>;
    return MockMarkdownEditor;
});
jest.mock('@/components/RichText', () => {
    const MockRichText = ({ content, className }) => <div data-testid="rich-text" className={className}>{content}</div>;
    return MockRichText;
});
jest.mock('@/components/Forum/LikeButton', () => function MockLike() { return <button type="button">Like</button>; });
jest.mock('@/hooks/useCharacterStats', () => ({
    __esModule: true,
    default: () => ({ joined: { toMillis: () => Date.UTC(2024, 2, 10) }, posts: 412, reputation: 128 }),
    joinedLabel: jest.requireActual('@/hooks/useCharacterStats').joinedLabel,
}));
jest.mock('@/lib/firebase', () => ({ db: null }));

describe('PostItem', () => {
    const mockPost = {
        id: 'post-123',
        userId: 'user-456',
        characterId: 'char-789',
        characterName: 'Aethelraed Vane',
        characterRace: 'Human',
        characterClass: 'Paladin',
        content: 'Hail well met!',
        status: 'approved',
        createdAt: { toDate: () => new Date(), toMillis: () => Date.now() - 18 * 60000 },
        characterImageUrl: 'http://example.com/avatar.jpg'
    };

    const handlers = {
        onEditStart: jest.fn(),
        onDelete: jest.fn(),
        onOpenCodex: jest.fn(),
        onCopyUserId: jest.fn(),
        onManageUser: jest.fn(),
        onMessageUser: jest.fn(),
    };

    beforeEach(() => jest.clearAllMocks());

    const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Post 3 options' }));

    it('shows the character profile, stats, post number and body', () => {
        render(<PostItem post={mockPost} number={3} {...handlers} />);
        expect(screen.getByRole('article', { name: 'Post 3 by Aethelraed Vane' })).toBeInTheDocument();
        expect(screen.getByText('Human · Paladin')).toBeInTheDocument();
        expect(screen.getByText('Mar 2024')).toBeInTheDocument();
        expect(screen.getByText('412')).toBeInTheDocument();
        expect(screen.getByText('128')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '#3' })).toHaveAttribute('href', '#post-3');
        expect(screen.getByText('Posted 18 minutes ago')).toBeInTheDocument();
        // Post body uses Inter (font-sans) in the story colour
        expect(screen.getByTestId('rich-text')).toHaveClass('font-sans');
    });

    it('portrait and name open the character codex entry', () => {
        render(<PostItem post={mockPost} number={3} {...handlers} />);
        const avatarBtns = screen.getAllByLabelText("View Aethelraed Vane's profile");
        expect(avatarBtns).toHaveLength(2); // mobile and desktop
        fireEvent.click(avatarBtns[0]);
        expect(handlers.onOpenCodex).toHaveBeenCalledWith('char-789');
    });

    it('marks posts that are awaiting approval', () => {
        render(<PostItem post={{ ...mockPost, status: 'pending' }} number={3} user={{ uid: 'user-456' }} {...handlers} />);
        expect(screen.getByText('Awaiting approval')).toBeInTheDocument();
    });

    it('owners can edit from the post menu', () => {
        render(<PostItem post={mockPost} number={3} user={{ uid: 'user-456' }} {...handlers} />);
        openMenu();
        const menu = within(screen.getByRole('menu'));
        expect(menu.queryByRole('menuitem', { name: /Message/ })).not.toBeInTheDocument();
        fireEvent.click(menu.getByRole('menuitem', { name: 'Edit post' }));
        expect(handlers.onEditStart).toHaveBeenCalledWith(mockPost);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('other players can message the author', () => {
        render(<PostItem post={mockPost} number={3} user={{ uid: 'other' }} {...handlers} />);
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Message Aethelraed' }));
        expect(handlers.onMessageUser).toHaveBeenCalledWith({ id: 'user-456', name: 'Aethelraed Vane', characterId: 'char-789' });
        expect(screen.queryByRole('menuitem', { name: 'Remove post' })).not.toBeInTheDocument();
    });

    it('moderators can copy the user id and remove the post; admins can manage roles', () => {
        render(<PostItem post={mockPost} number={3} user={{ uid: 'mod' }} isAdminOrMod isAdmin {...handlers} />);
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Copy user ID' }));
        expect(handlers.onCopyUserId).toHaveBeenCalledWith('user-456');
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Manage role' }));
        expect(handlers.onManageUser).toHaveBeenCalled();
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Remove post' }));
        expect(handlers.onDelete).toHaveBeenCalledWith('post-123');
    });

    it('guests get no post menu', () => {
        render(<PostItem post={mockPost} number={3} user={null} {...handlers} />);
        expect(screen.queryByRole('button', { name: 'Post 3 options' })).not.toBeInTheDocument();
    });

    it('Escape closes the menu', () => {
        render(<PostItem post={mockPost} number={3} user={{ uid: 'other' }} {...handlers} />);
        openMenu();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('shows the editor while editing', () => {
        render(<PostItem post={mockPost} number={3} user={{ uid: 'user-456' }} editingPostId="post-123" editPostContent="x" onEditSave={jest.fn()} onEditCancel={jest.fn()} onEditChange={jest.fn()} {...handlers} />);
        expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save edits' })).toBeInTheDocument();
    });
});
