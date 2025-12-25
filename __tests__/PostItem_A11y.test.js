import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import PostItem from '../src/components/Forum/PostItem';

// Mock child components
jest.mock('../src/components/MarkdownEditor', () => () => <div data-testid="markdown-editor">Editor</div>);
jest.mock('../src/components/RichText', () => ({ content }) => <div data-testid="rich-text">{content}</div>);

// Mock Lucide icons to avoid render issues (though usually fine, safer to mock if they cause trouble)
// but for standard Jest environment they should be fine. We'll leave them be unless valid issues arise.

describe('PostItem Accessibility', () => {
    const mockPost = {
        id: 'post-123',
        userId: 'user-456',
        characterId: 'char-789',
        characterName: 'Aethelraed',
        characterRace: 'Human',
        characterClass: 'Paladin',
        content: 'Hail well met!',
        createdAt: { toDate: () => new Date() },
        characterImageUrl: 'http://example.com/avatar.jpg'
    };

    const mockHandlers = {
        onEditStart: jest.fn(),
        onDelete: jest.fn(),
        onOpenCodex: jest.fn(),
        onCopyUserId: jest.fn(),
    };

    it('renders avatar button with accessible label', () => {
        render(<PostItem post={mockPost} {...mockHandlers} />);

        // The desktop avatar button
        const avatarBtn = screen.getByLabelText("View Aethelraed's profile");
        expect(avatarBtn).toBeInTheDocument();
        expect(avatarBtn.tagName).toBe('BUTTON');
    });

    it('renders owner actions with accessible labels', () => {
        const user = { uid: 'user-456' }; // Same as post.userId
        render(<PostItem post={mockPost} user={user} {...mockHandlers} />);

        const editBtn = screen.getByLabelText('Edit Post');
        expect(editBtn).toBeInTheDocument();
        expect(editBtn).toHaveAttribute('title', 'Edit Post');
    });

    it('renders moderator actions with accessible labels', () => {
        const user = { uid: 'mod-user' };
        render(<PostItem post={mockPost} user={user} isAdminOrMod={true} {...mockHandlers} />);

        const deleteBtn = screen.getByLabelText('Delete Post');
        expect(deleteBtn).toBeInTheDocument();

        const copyIdBtn = screen.getByLabelText('Copy User ID');
        expect(copyIdBtn).toBeInTheDocument();
    });

    it('does not render privileged buttons for standard users', () => {
        const user = { uid: 'other-user' };
        render(<PostItem post={mockPost} user={user} isAdminOrMod={false} {...mockHandlers} />);

        expect(screen.queryByLabelText('Delete Post')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Edit Post')).not.toBeInTheDocument();
    });
});
