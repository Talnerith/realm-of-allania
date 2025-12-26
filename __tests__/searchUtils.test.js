import { filterCodexResults, filterThreadResults, filterPostResults, getSnippet } from '@/lib/searchUtils';

describe('Search Utils', () => {
    describe('filterCodexResults', () => {
        const mockDocs = [
            { id: '1', data: () => ({ title: 'Dragon', category: 'Bestiary' }) },
            { id: '2', data: () => ({ title: 'Sword', category: 'Items' }) },
            { id: '3', data: () => ({ title: 'Ancient Dragon', category: 'Bestiary' }) },
        ];

        it('should filter by title', () => {
            const results = filterCodexResults(mockDocs, 'dragon');
            expect(results).toHaveLength(2);
            expect(results.map(r => r.title)).toContain('Dragon');
            expect(results.map(r => r.title)).toContain('Ancient Dragon');
        });

        it('should filter by category', () => {
            const results = filterCodexResults(mockDocs, 'items');
            expect(results).toHaveLength(1);
            expect(results[0].title).toBe('Sword');
        });

        it('should return empty array if no match', () => {
            const results = filterCodexResults(mockDocs, 'shield');
            expect(results).toHaveLength(0);
        });

        it('should handle case insensitivity', () => {
            const results = filterCodexResults(mockDocs, 'DRAGON');
            expect(results).toHaveLength(2);
        });
    });

    describe('filterThreadResults', () => {
        const mockDocs = [
            { id: '1', data: () => ({ title: 'General Discussion' }) },
            { id: '2', data: () => ({ title: 'Roleplay Thread 1' }) },
        ];

        it('should filter by title', () => {
            const results = filterThreadResults(mockDocs, 'roleplay');
            expect(results).toHaveLength(1);
            expect(results[0].title).toBe('Roleplay Thread 1');
        });
    });

    describe('filterPostResults', () => {
        const mockDocs = [
            { id: '1', data: () => ({ content: 'This is a test post about magic.', characterName: 'Gandalf' }) },
            { id: '2', data: () => ({ content: 'Another post.', characterName: 'Aragorn' }) },
        ];

        it('should filter by content', () => {
            const results = filterPostResults(mockDocs, 'magic');
            expect(results).toHaveLength(1);
            expect(results[0].characterName).toBe('Gandalf');
        });

        it('should filter by characterName', () => {
            const results = filterPostResults(mockDocs, 'aragorn');
            expect(results).toHaveLength(1);
            expect(results[0].content).toBe('Another post.');
        });
    });

    describe('getSnippet', () => {
        const text = "This is a very long text that contains the word magic somewhere in the middle so we can test snippet generation.";

        it('should return snippet with context', () => {
            const snippet = getSnippet(text, 'magic');
            expect(snippet).toContain('magic');
            expect(snippet).toContain('...');
            // Check that it doesn't return the whole text if it's too long (mock text is short though, let's verify logic)
        });

        it('should return start of text if match not found (fallback)', () => {
             const snippet = getSnippet(text, 'nomatch');
             expect(snippet).toContain('This is a very long');
        });

        it('should handle empty text', () => {
            expect(getSnippet(null, 'test')).toBe('');
            expect(getSnippet('', 'test')).toBe('');
        });
    });
});
