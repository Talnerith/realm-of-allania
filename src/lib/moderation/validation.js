import { FORBIDDEN_KEYWORDS } from './forbiddenKeywords';

/**
 * Validates post content for length and forbidden keywords.
 * @param {string} text - The post content to validate.
 * @returns {{ isValid: boolean, error?: string }} - Result of validation.
 */
export function validatePostContent(text) {
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

  if (trimmedText.length > 5000) {
    return { isValid: false, error: 'Content cannot exceed 5000 characters.' };
  }

  const lowerText = trimmedText.toLowerCase();
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return { isValid: false, error: `Content contains forbidden keyword: ${keyword}` };
    }
  }

  return { isValid: true };
}
