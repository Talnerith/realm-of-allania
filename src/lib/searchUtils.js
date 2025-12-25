// Search Logic Utility for Unit Testing

export const filterCodexResults = (docs, query) => {
    const lowerQuery = query.toLowerCase();
    return docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item =>
            (item.title && item.title.toLowerCase().includes(lowerQuery)) ||
            (item.category && item.category.toLowerCase().includes(lowerQuery))
        );
};

export const filterThreadResults = (docs, query) => {
    const lowerQuery = query.toLowerCase();
    return docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item =>
            (item.title && item.title.toLowerCase().includes(lowerQuery))
        );
};

export const filterPostResults = (docs, query) => {
    const lowerQuery = query.toLowerCase();
    return docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item =>
            (item.content && item.content.toLowerCase().includes(lowerQuery)) ||
            (item.characterName && item.characterName.toLowerCase().includes(lowerQuery))
        );
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
