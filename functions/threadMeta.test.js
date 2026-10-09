const { plainExcerpt, threadMetaUpdate, EXCERPT_LENGTH } = require('./threadMeta');

const ts = (ms) => ({ toMillis: () => ms });

describe('plainExcerpt', () => {
    it('strips markdown, links and images', () => {
        expect(plainExcerpt('*The smoke* rose over [[Emberfall Keep]]. ![map](x.png) See [the road](https://a.b).'))
            .toBe('The smoke rose over Emberfall Keep. See the road.');
    });

    it('cuts long text on a word boundary with an ellipsis', () => {
        const out = plainExcerpt('word '.repeat(100));
        expect(out.length).toBeLessThanOrEqual(EXCERPT_LENGTH + 1);
        expect(out.endsWith('word…')).toBe(true);
    });

    it('handles empty content', () => {
        expect(plainExcerpt(undefined)).toBe('');
    });
});

describe('threadMetaUpdate', () => {
    const post = { content: 'Hello there, traveller.', characterName: 'Aldric', characterId: 'c1', createdAt: ts(2000) };

    it('records the opening post excerpt and last reply', () => {
        expect(threadMetaUpdate({ postCount: 1 }, post, 'p1', true)).toEqual({
            excerpt: 'Hello there, traveller.', openingPostId: 'p1',
            lastPostBy: 'Aldric', lastPostCharacterId: 'c1', lastPostAt: post.createdAt
        });
    });

    it('a newer reply updates only the last reply', () => {
        const thread = { openingPostId: 'p1', excerpt: 'x', postCount: 3, lastPostAt: ts(1000), lastPostBy: 'Lyra' };
        expect(threadMetaUpdate(thread, { ...post, characterName: 'Brannock', characterId: 'c9' }, 'p3', false)).toEqual({
            lastPostBy: 'Brannock', lastPostCharacterId: 'c9', lastPostAt: post.createdAt
        });
    });

    it('re-approving an edited older post changes nothing about the last reply', () => {
        const thread = { openingPostId: 'p1', excerpt: 'x', postCount: 3, lastPostAt: ts(5000), lastPostBy: 'Lyra', lastPostCharacterId: 'c2' };
        expect(threadMetaUpdate(thread, post, 'p2', false)).toBeNull();
    });

    it('an edited opening post refreshes the excerpt', () => {
        const thread = { openingPostId: 'p1', excerpt: 'Old text', postCount: 3, lastPostAt: ts(5000), lastPostBy: 'Lyra', lastPostCharacterId: 'c2' };
        expect(threadMetaUpdate(thread, post, 'p1', false)).toEqual({ excerpt: 'Hello there, traveller.' });
    });
});
