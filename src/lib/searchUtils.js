// Search Logic Utility for Unit Testing
// OPTIMIZATION: Using reduce() for single-pass filtering instead of map().filter()

export const filterCodexResults = (docs, query) => {
    const lowerQuery = query.toLowerCase();
    return docs.reduce((acc, d) => {
        const item = { id: d.id, ...d.data() };
        if ((item.title?.toLowerCase().includes(lowerQuery)) ||
            (item.category?.toLowerCase().includes(lowerQuery))) {
            acc.push(item);
        }
        return acc;
    }, []);
};

export const filterThreadResults = (docs, query) => {
    const lowerQuery = query.toLowerCase();
    return docs.reduce((acc, d) => {
        const item = { id: d.id, ...d.data() };
        if (item.title?.toLowerCase().includes(lowerQuery)) {
            acc.push(item);
        }
        return acc;
    }, []);
};

export const filterPostResults = (docs, query) => {
    const lowerQuery = query.toLowerCase();
    return docs.reduce((acc, d) => {
        const item = { id: d.id, ...d.data() };
        if ((item.content?.toLowerCase().includes(lowerQuery)) ||
            (item.characterName?.toLowerCase().includes(lowerQuery))) {
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
