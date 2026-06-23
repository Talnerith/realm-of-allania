/**
 * Common utility functions for the Realm of Allania application
 */

/**
 * Format Firestore timestamp to localized date string
 * @param {Object} firestoreTimestamp - Firestore timestamp object
 * @returns {string} Formatted date string
 */
export const formatTimestamp = (firestoreTimestamp) => {
  if (!firestoreTimestamp?.toDate) return 'Just now';
  return firestoreTimestamp.toDate().toLocaleDateString();
};

/**
 * Format Firestore timestamp to relative time (e.g., "2 hours ago")
 * @param {Object} firestoreTimestamp - Firestore timestamp object
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (firestoreTimestamp) => {
  if (!firestoreTimestamp?.toDate) return 'Just now';
  
  const now = Date.now();
  const then = firestoreTimestamp.toMillis();
  const diffMs = now - then;
  
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return firestoreTimestamp.toDate().toLocaleDateString();
};

/**
 * Truncate text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

/**
 * Debounce function to limit rate of function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Generate a random ID for client-side use
 * @returns {string} Random ID
 */
export const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if user is on mobile device
 * @returns {boolean} True if mobile
 */
export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
};

/**
 * Copy text to clipboard with fallback
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        return true;
      } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        return false;
      } finally {
        document.body.removeChild(textArea);
      }
    }
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
};

/**
 * Sanitize HTML/Markdown content to prevent XSS
 * Note: This is a basic implementation. For production, consider using DOMPurify
 * @param {string} content - Content to sanitize
 * @returns {string} Sanitized content
 */
export const sanitizeContent = (content) => {
  if (!content) return '';
  
  // Basic XSS prevention - escapes HTML tags
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * Get initials from name
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
 */
export const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * Format large numbers with K/M suffixes
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

/**
 * Sleep/delay function for async operations
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if code is running on client side
 * @returns {boolean} True if client side
 */
export const isClient = () => typeof window !== 'undefined';

/**
 * Get error message from various error types
 * @param {Error|string|unknown} error - Error object
 * @returns {string} Error message
 */
export const getErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error?.message) return error.message;
  return 'An unknown error occurred';
};

