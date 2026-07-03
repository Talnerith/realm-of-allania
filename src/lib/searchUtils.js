// Search Logic Utility for Unit Testing
// OPTIMIZATION: Using reduce() for single-pass filtering instead of map().filter()

// MODERATION: same visibility rule as RegionView/ThreadView/CodexIndex —
// approved (or legacy, no status) for everyone; own/pending for the author; everything for mods
export const isContentVisible = (item, { userId = null, isMod = false } = {}) => {
    if (item.status === 'approved' || !item.status) return true;
    if (isMod) return true;
    return !!userId && (item.userId === userId || item.creatorId === userId);
};

export const filterCodexResults = (docs, query, viewer) => {
    const lowerQuery = query.toLowerCase();
    return docs.reduce((acc, d) => {
        const item = { id: d.id, ...d.data() };
        if (isContentVisible(item, viewer) &&
            ((item.title?.toLowerCase().includes(lowerQuery)) ||
             (item.category?.toLowerCase().includes(lowerQuery)))) {
            acc.push(item);
        }
        return acc;
    }, []);
};

export const filterThreadResults = (docs, query, viewer) => {
    const lowerQuery = query.toLowerCase();
    return docs.reduce((acc, d) => {
        const item = { id: d.id, ...d.data() };
        if (isContentVisible(item, viewer) && item.title?.toLowerCase().includes(lowerQuery)) {
            acc.push(item);
        }
        return acc;
    }, []);
};

export const filterPostResults = (docs, query, viewer) => {
    const lowerQuery = query.toLowerCase();
    return docs.reduce((acc, d) => {
        const item = { id: d.id, ...d.data() };
        if (isContentVisible(item, viewer) &&
            ((item.content?.toLowerCase().includes(lowerQuery)) ||
             (item.characterName?.toLowerCase().includes(lowerQuery)))) {
            acc.push(item);
        }
        return acc;
    }, [])
};

// Also export the snippet helper
export const getSnippet = (text, query) => {
    if (!text) return '';
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(query.toLowerCase());
    if (index === -1) return text.substring(0, 100) + '...';

    const start = Math.max(0, index - 40);
    const end = Math.min(text.length, index + query.length + 60);
    return (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
};
