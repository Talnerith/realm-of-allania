const { FORBIDDEN_KEYWORDS } = require('./forbiddenKeywords');

// Same matching as src/lib/moderation/textRules.js (and hasForbiddenText in
// firestore.rules): on lowercased text, longer keywords match anywhere, short
// ones only as whole words ("kys" doesn't hit "Alkyshire", nor "xxx"
// "Chapter XXXI").
const WHOLE_WORD_MAX_LENGTH = 3;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const KEYWORD_PATTERNS = FORBIDDEN_KEYWORDS.map((keyword) => {
    const lower = escapeRegex(keyword.toLowerCase());
    return {
        keyword,
        pattern: keyword.length > WHOLE_WORD_MAX_LENGTH
            ? new RegExp(lower)
            : new RegExp(`(^|[^a-z0-9])${lower}([^a-z0-9]|$)`)
    };
});

// The first forbidden keyword in the text, or null
function findForbiddenKeyword(text) {
    if (typeof text !== 'string') return null;
    const lower = text.toLowerCase();
    const hit = KEYWORD_PATTERNS.find(({ pattern }) => pattern.test(lower));
    return hit ? hit.keyword : null;
}

/**
 * Validates post content for length and forbidden keywords.
 * @param {string} text - The post content to validate.
 * @param {number} [maxLength=5000] - Maximum allowed length (codex pages allow 10000).
 * @returns {{ isValid: boolean, error?: string }} - Result of validation.
 */
function validatePostContent(text, maxLength = 5000) {
    if (typeof text !== 'string') {
        return { isValid: false, error: 'Content must be a string.' };
    }

    const trimmedText = text.trim();

    if (trimmedText.length === 0) {
        return { isValid: false, error: 'Content cannot be empty or whitespace only.' };
    }

    if (trimmedText.length < 10) {
        return { isValid: false, error: 'Content must be at least 10 characters long.' };
    }

    if (trimmedText.length > maxLength) {
        return { isValid: false, error: `Content cannot exceed ${maxLength} characters.` };
    }

    const keyword = findForbiddenKeyword(trimmedText);
    if (keyword) {
        return { isValid: false, error: `Content contains forbidden keyword: ${keyword}` };
    }

    return { isValid: true };
}

module.exports = { validatePostContent, findForbiddenKeyword, WHOLE_WORD_MAX_LENGTH };
